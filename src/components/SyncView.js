import styled from 'styled-components'
import React from 'react'
import randombytes from 'randombytes'
import {ipcRenderer, remote} from 'electron'

import replicate from '../lib/replicate'
import Modal from './Modal'
import Form from './Form'
import i18n from '../lib/i18n'

// turn the messages into strings once
// so the function isn't called for every row

var messages = {
  'replication-data-complete': i18n('replication-data-complete'),
  'replication-started': i18n('replication-started'),
  'replication-complete': i18n('replication-complete'),
  'media-connected': i18n('replication-progress'),
  'osm-connected': i18n('replication-progress')
}
var SyncButton = styled.button`
  background-color: orange;
  padding: 0px 20px;
`

var Subtitle = styled.div`
  background-color: var(--main-bg-color);
  color: white;
  vertical-align: middle;
  padding: 5px 15px;
`

var TargetsDiv = styled.div`
  background-color: white;
  color: black;
  .loading {
    background-color: white;
    color: grey;
    text-align: center;
    font-style: italic;
    font-size: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }
`

var Target = styled.li`
  min-width: 500px;
  padding: 20px;
  border-bottom: 1px solid grey;
  display: flex;
  justify-content: space-between;
  line-height: 30px;
  .target {
    vertical-align: middle;
    font-weight: bold;
    font-size: 16px;
  }
  .info {
    padding-left: 10px;
    font-weight: normal;
    font-size: 14px;
    font-style: italic;
  }
}
`

export default class SyncView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      targets: []
    }
    this.streams = {}
    this.selectFile = this.selectFile.bind(this)
  }

  replicate (target) {
    var self = this
    if (!target) return
    var stream = replicate.start(target)
    var id = randombytes(16).toString('hex')
    this.streams[id] = stream
    stream.on('data', function (data) {
      // TODO: add debugging
    })
    stream.on('error', function (err) {
      if (err) console.error(err)
      delete self.streams[id]
    })

    stream.on('end', function () {
      delete self.streams[id]
    })
  }

  componentWillUnmount () {
    var self = this
    Object.keys(this.streams).map((k) => self.streams[k].destroy())
    this.streams = {}
    ipcRenderer.removeListener('select-file', this.selectFile)
  }

  componentDidMount () {
    this.interval = setInterval(this.updateTargets.bind(this), 1000)
    replicate.announce(function (err) {
      if (err) console.error(err)
    })
    ipcRenderer.on('select-file', this.selectFile)
  }

  onClose () {
    this.props.onClose()
    ipcRenderer.send('refresh-window')
  }

  updateTargets () {
    var self = this
    replicate.getTargets(function (err, targets) {
      if (err) return console.error(err)
      self.setState({targets})
    })
  }

  selectExisting (event) {
    event.preventDefault()
    ipcRenderer.send('open-file')
  }

  selectNew (event) {
    event.preventDefault()
    ipcRenderer.send('save-file')
  }
  selectFile (event, filename) {
    if (!filename) return
    this.replicate({filename})
  }

  render () {
    var self = this
    var {targets} = this.state
    if (this.props.filename) this.replicate({filename: this.props.filename})
    var onClose = this.onClose.bind(this)

    return (
      <Modal closeButton={false} onClose={onClose} title={i18n('sync-database-lead')}>
        <TargetsDiv>
        {targets.length === 0
          ? <Subtitle>Searching for devices&hellip;</Subtitle>
          : <Subtitle>Available Devices</Subtitle>
        }
          <ul>
            {targets.map(function (t) {
              if (t.name === 'localhost') return
              var message = messages[t.status] || t.message
              return (
                <Target key={t.name}>
                  <div className='target'>
                    <span className='name'>{t.name}</span>
                    <span className='info'>via {t.type}</span>
                  </div>
                  {t.status ? <h3>{message}</h3> :
                    <SyncButton onClick={self.replicate.bind(self, t)}>
                      arrow
                    </SyncButton>
                  }
                </Target>
              )
            })}
          </ul>
        </TargetsDiv>
          <Form method='POST'>
            <input type='hidden' name='source' />
            <div className='button-group'>
              <button className='big' onClick={this.selectExisting}>
                <span id='button-text'>
                  {i18n('sync-database-open-button')}&hellip;
                </span>
              </button>
              <button className='big' onClick={this.selectNew}>
                <span id='button-text'>
                  {i18n('sync-database-new-button')}&hellip;
                </span>
              </button>
              <button className='big' onClick={onClose}>
              Done
              </button>
            </div>
          </Form>
        </Modal>
    )
  }
}
