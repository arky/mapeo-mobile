import React from 'react'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'

export default class LatLonDialog extends React.Component {
  render () {
    // TODO: escape this html for displaying newlines
    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          {this.props.message}
        </DialogContent>
      </Dialog>
    )
  }
}
