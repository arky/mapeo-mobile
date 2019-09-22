var path = require('path')
var os = require('os')
var { ipcMain } = require('electron')
var createMapeoRouter = require('mapeo-server')
var ecstatic = require('ecstatic')
var createOsmRouter = require('osm-p2p-server')
var http = require('http')
var logger = require('electron-timber')
var throttle = require('lodash/throttle')

module.exports = function (osm, media, sendIpc, opts) {
  if (!opts) opts = {}
  var osmRouter = createOsmRouter(osm)
  var mapeoRouter = createMapeoRouter(osm, media, {
    staticRoot: opts.staticRoot,
    writeFormat: 'osm-p2p-syncfile',
    deviceType: 'desktop'
  })

  const mapeoCore = mapeoRouter.api.core

  // hostname often includes a TLD, which we remove
  const computerName = (os.hostname() || 'Mapeo Desktop').split('.')[0]
  mapeoCore.sync.setName(computerName)

  var server = http.createServer(function (req, res) {
    logger.log(req.method + ': ' + req.url)

    var staticHandler = ecstatic({
      root: path.join(__dirname, '..', '..', 'static'),
      baseDir: 'static'
    })

    var m = osmRouter.handle(req, res) || mapeoRouter.handle(req, res)
    if (!m) {
      staticHandler(req, res, function (err) {
        if (err) console.error(err)
        res.statusCode = 404
        res.end('Not Found')
      })
    }
  })

  server.mapeo = mapeoCore

  const origListen = server.listen
  const origClose = server.close

  // Sending data over IPC is costly, and progress events fire frequently, so we
  // throttle updates to once every 50ms
  const throttledSendPeerUpdate = throttle(sendPeerUpdate, 50)

  server.listen = function listen (...args) {
    mapeoCore.sync.listen(() => {
      mapeoCore.sync.on('peer', throttledSendPeerUpdate)
      mapeoCore.sync.on('down', throttledSendPeerUpdate)
      ipcMain.on('sync-start', startSync)
      origListen.apply(server, args)
    })
  }

  // Send message to frontend whenever there is an update to the peer list
  function sendPeerUpdate (peer) {
    const peers = mapeoCore.sync.peers().map(peer => {
      const { connection, ...rest } = peer
      return rest
    })
    sendIpc('peer-update', peers)
  }

  function startSync (event, target = {}) {
    logger.log('Sync start request:', target)
    if (!target.host || !target.port) return
    const startTime = Date.now()
    const sync = mapeoCore.sync.replicate(target, { deviceType: 'mobile' })
    sync.on('error', onerror)
    sync.on('progress', throttledSendPeerUpdate)
    sync.on('end', onend)
    sendPeerUpdate()

    function onerror (err) {
      logger.error(err)
      sync.removeListener('error', onerror)
      sync.removeListener('progress', throttledSendPeerUpdate)
      sync.removeListener('end', onend)
    }

    function onend (err) {
      if (err) logger.error(err)
      const syncDurationSecs = ((Date.now() - startTime) / 1000).toFixed(2)
      logger.log('Sync completed in ' + syncDurationSecs + ' seconds')
      sync.removeListener('error', onerror)
      sync.removeListener('progress', throttledSendPeerUpdate)
      sync.removeListener('end', onend)
      sendPeerUpdate()
    }
  }

  server.close = function close (cb) {
    mapeoCore.sync.removeListener('peer', throttledSendPeerUpdate)
    mapeoCore.sync.removeListener('down', throttledSendPeerUpdate)
    ipcMain.removeListener('start-sync', startSync)
    onReplicationComplete(() => {
      mapeoCore.sync.destroy(() => origClose.call(server, cb))
    })
  }

  function onReplicationComplete (cb) {
    // Wait for up to 10 minutes for replication to complete
    const timeoutId = setTimeout(() => {
      mapeoCore.sync.removeListener('down', checkIfDone)
      cb()
    }, 10 * 60 * 1000)

    checkIfDone()

    function checkIfDone () {
      const currentlyReplicatingPeers = mapeoCore.sync
        .peers()
        .filter(
          peer =>
            peer.state &&
            (peer.state.topic === 'replication-started' ||
              peer.state.topic === 'replication-progress')
        )
      logger.log(currentlyReplicatingPeers.length + ' peers still replicating')
      if (currentlyReplicatingPeers.length === 0) {
        clearTimeout(timeoutId)
        return cb()
      }
      mapeoCore.sync.once('down', checkIfDone)
    }
  }

  return server
}
