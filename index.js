#!/usr/bin/env electron

var path = require('path')
var minimist = require('minimist')
var electron = require('electron')
var app = electron.app
var Menu = electron.Menu
var BrowserWindow = electron.BrowserWindow

var mkdirp = require('mkdirp')
var sublevel = require('subleveldown')
var osmdb = require('osm-p2p')
var series = require('run-series')
var MediaStore = require('safe-fs-blob-store')
var styles = require('mapeo-styles')

var menuTemplate = require('./src/main/menu')
var createServer = require('./src/main/server.js')
var createTileServer = require('./src/main/tile-server.js')

var installStatsIndex = require('./src/main/osm-stats')
var userConfig = require('./src/main/user-config')
var TileImporter = require('./src/main/tile-importer')
var exportData = require('./src/main/export-data')
var importer = require('./src/main/importer')
var locale = require('./src/main/locale')
var i18n = require('./src/i18n')

if (require('electron-squirrel-startup')) {
  process.exit(0)
}

// HACK: enable GPU graphics acceleration on some older laptops
app.commandLine.appendSwitch('ignore-gpu-blacklist', 'true')

var APP_NAME = app.getName()
var IS_TEST = process.env.NODE_ENV === 'test'

var log = require('./src/log').Node()

var win = null

// Listen for app-ready event
var appIsReady = false
app.once('ready', function () {
  appIsReady = true
})

// Set up global node exception handler
handleUncaughtExceptions()
log('[STARTUP] Listening for uncaught exceptions')

// Path to `userData`, operating system specific, see
// https://github.com/atom/electron/blob/master/docs/api/app.md#appgetpathname
var userDataPath = app.getPath('userData')

var argv = minimist(process.argv.slice(2), {
  default: {
    port: 5000,
    datadir: path.join(userDataPath, 'database'),
    tileport: 5005
  },
  boolean: [ 'headless', 'debug' ],
  alias: {
    p: 'port',
    t: 'tileport',
    d: 'debug'
  }
})

function startupMsg (txt) {
  return function (done) {
    console.log('[STARTUP] ' + txt)
    done()
  }
}

startupMsg('Unpacking Styles')
// This is necessary to make sure that the styles and presets directory
// are writable by the user
mkdirp(path.join(userDataPath, 'styles'), function (err) {
  if (err) log(err)
  mkdirp(path.join(userDataPath, 'presets'), function (err) {
    if (err) log(err)
    styles.unpackIfNew(userDataPath, function (err) {
      if (err) log('[ERROR] while unpacking styles:', err)
    })
  })
})

// The app startup sequence
series([
  startupMsg('Checked indexes version is up-to-date'),

  initOsmDb,
  startupMsg('Initialized osm-p2p'),

  createServers,
  startupMsg('Started osm and tile servers'),

  createMainWindow,
  startupMsg('Created app window')

], function (err) {
  if (err) log('STARTUP FAILED', err)
  else log('STARTUP success!')
})

function initOsmDb (done) {
  mkdirp.sync(argv.datadir)
  var osm = osmdb(argv.datadir)
  log('loading datadir', argv.datadir)

  var idb = sublevel(osm.index, 'stats')
  osm.core.use('stats', installStatsIndex(idb))

  var media = MediaStore(path.join(argv.datadir, 'media'))
  app.osm = osm
  app.media = media
  app.importer = importer(osm)
  app.tiles = TileImporter(userDataPath)

  log('preparing osm indexes..')

  done()
}

function createServers (done) {
  app.server = createServer(app.osm, app.media, { staticRoot: userDataPath })

  var pending = 2

  app.server.listen(argv.port, '127.0.0.1', function () {
    global.osmServerHost = '127.0.0.1:' + app.server.address().port
    log(global.osmServerHost)
    if (--pending === 0) done()
  })

  var tileServer = createTileServer()
  tileServer.listen(argv.tileport, function () {
    log('tile server listening on :', tileServer.address().port)
    if (--pending === 0) done()
  })
}

function createMainWindow (done) {
  app.translations = locale.load()
  if (!argv.headless) {
    if (!appIsReady) {
      app.once('ready', ready)
    } else {
      ready()
    }

    app.on('before-quit', function () {
      app.server.mapeo.api.close(function () {
        app.server.close()
      })
    })

    // Quit when all windows are closed.
    app.on('window-all-closed', function () {
      app.quit()
    })
  } else {
    done()
  }

  function ready () {
    if (argv.headless) return

    var INDEX = 'file://' + path.resolve(__dirname, './index.html')
    if (!win) {
      win = new BrowserWindow({
        title: APP_NAME,
        show: false,
        icon: path.resolve(__dirname, 'static', 'mapeo_256x256.png')
      })
      win.once('ready-to-show', () => win.show())
      if (IS_TEST) win.setSize(1000, 800, false)
      else win.maximize()
    }

    if (argv.debug) win.webContents.openDevTools()
    win.loadURL(INDEX)

    var ipc = electron.ipcMain

    ipc.on('get-user-data', function (event, type) {
      var data = userConfig.getSettings(type)
      if (!data) console.warn('unhandled event', type)
      event.returnValue = data
    })

    app.importer.on('import-error', function (err, filename) {
      win.webContents.send('import-error', err, path.basename(filename))
    })

    app.importer.on('import-complete', function (filename) {
      win.webContents.send('import-complete', path.basename(filename))
    })

    app.importer.on('import-progress', function (filename, index, total) {
      win.webContents.send('import-progress', path.basename(filename), index, total)
    })

    ipc.on('error', function (ev, message) {
      win.webContents.send('error', message)
    })

    ipc.on('set-locale', function (ev, lang) {
      app.translations = locale.load(lang)
    })

    ipc.on('import-example-presets', function (ev) {
      var filename = path.join(__dirname, 'static', 'settings-jungle-v1.0.0.mapeosettings')
      userConfig.importSettings(win, filename, function (err) {
        if (err) return log(err)
        log('Example presets imported from ' + filename)
      })
    })

    ipc.on('import-settings', function (ev, filename) {
      console.log('importing settings')
      userConfig.importSettings(win, filename, function (err) {
        if (err) return log(err)
        log('Example presets imported from ' + filename)
      })
    })

    ipc.on('save-file', function () {
      var metadata = userConfig.getSettings('metadata')
      var ext = metadata ? metadata.dataset_id : 'mapeodata'
      electron.dialog.showSaveDialog({
        title: i18n('save-db-dialog'),
        defaultPath: 'database.' + ext,
        filters: [
          { name: 'Mapeo Data (*.' + ext + ')', extensions: ['mapeodata', 'mapeo-jungle', ext] }
        ]
      }, onopen)

      function onopen (filename) {
        if (typeof filename === 'undefined') return
        win.webContents.send('select-file', filename)
      }
    })

    ipc.on('open-file', function () {
      var metadata = userConfig.getSettings('metadata')
      var ext = metadata ? metadata.dataset_id : 'mapeodata'
      electron.dialog.showOpenDialog({
        title: i18n('open-db-dialog'),
        properties: [ 'openFile' ],
        filters: [
          { name: 'Mapeo Data (*.' + ext + ')', extensions: ['mapeodata', 'mapeo-jungle', ext, 'sync', 'zip'] }
        ]
      }, onopen)

      function onopen (filenames) {
        if (typeof filenames === 'undefined') return
        if (filenames.length === 1) {
          var file = filenames[0]
          win.webContents.send('select-file', file)
        }
      }
    })

    ipc.on('export-data', function (_, name, ext) {
      exportData.openDialog(app, name, ext)
    })

    ipc.on('zoom-to-data-get-centroid', function (_, type) {
      getDatasetCentroid(type, function (_, loc) {
        console.log(_, loc)
        if (!loc) return
        win.webContents.send('zoom-to-data-response', loc)
      })
    })

    ipc.on('zoom-to-latlon-request', function (_, lat, lon) {
      win.webContents.send('zoom-to-latlon-response', lat, lon)
    })

    ipc.on('refresh-window', function () {
      win.webContents.send('refresh-window')
    })

    var menu = Menu.buildFromTemplate(menuTemplate(app))
    Menu.setApplicationMenu(menu)

    win.webContents.once('did-finish-load', function () {
      win.webContents.send('indexes-loading')
      app.osm.ready(function () {
        log('indexes READY')
        win.webContents.send('indexes-ready')
      })
    })

    // Emitted when the window is closed.
    win.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      win = null
      app.quit()
    })

    done()
  }
}

function handleUncaughtExceptions () {
  process.on('uncaughtException', function (error) {
    log('uncaughtException in Node:', error)

    // Show a vaguely informative dialog.
    if (app && win) {
      var opts = {
        type: 'error',
        buttons: [ 'OK' ],
        title: 'Error Fatal',
        message: error.message
      }
      electron.dialog.showMessageBox(win, opts, function () {
        process.exit(1)
      })
    }
  })
}

function getDatasetCentroid (type, done) {
  log('STATUS(getDatasetCentroid):', type)
  app.osm.core.api.stats.getMapCenter(type, function (err, center) {
    if (err) return log('ERROR(getDatasetCentroid):', err)
    console.log('center', center)
    if (!center) return done(null, null)
    done(null, [center.lon, center.lat])
  })
}
