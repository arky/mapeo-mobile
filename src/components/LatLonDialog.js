import DialogActions from 'material-ui/DialogActions'
import Button from 'material-ui/Button'
import Input from 'material-ui/Input'
import DialogContent from 'material-ui/DialogContent'
import DialogTitle from 'material-ui/DialogTitle'
import FormControl from 'material-ui/FormControl'

import React from 'react'
import {ipcRenderer} from 'electron'

import i18n from '../lib/i18n'
import Modal from './Modal'

export default class LatLonDialog extends React.Component {
  submitHandler (event) {
    var self = this
    var text = document.getElementById('latlon-text').value
    var rx = /(-?\d+\.?\d*)[^01234567890-]+(-?\d+\.?\d*)/
    var match = rx.exec(text)
    if (match) {
      var pt = [ parseFloat(match[1].trim()), parseFloat(match[2].trim()) ]
      ipcRenderer.send('zoom-to-latlon-request', pt[0], pt[1])
      self.props.onClose()
    }
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    return false
  }

  render () {
    return (
      <Modal onClose={this.props.onClose}>
        <DialogTitle>{i18n('dialog-enter-latlon-coordinates')}</DialogTitle>
        <DialogContent>
          <FormControl>
            <Input id='latlon-text' placeholder='Lon, Lat' type='text' />
            <DialogActions>
              <Button onClick={this.submitHandler.bind(this)}>{i18n('button-submit')}</Button>
            </DialogActions>
          </FormControl>
        </DialogContent>
      </Modal>
    )
  }
}
