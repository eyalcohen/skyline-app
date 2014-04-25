/*
 * Common javascript functions for the client
 */

define([
  'jQuery',
  'Underscore',
  'rpc',
  'util',
  'views/upload'
], function ($, _, rpc, util, Upload) {

  /* upload - handles the first stage of uploading files to the server.
   * Takes a closure around 'file', 'this.app', and 'reader'
   * cbProgress is a function that takes a string percentage
   * cbUpload is a callback for the second stage of upload completion
   */
  return { 
  
    upload: function(file, reader, app, cbSuccess, cbFail, cbProgress, cbUpload) {

      var ext = file.name.split('.').pop();

      var chunkSize = 16384;
      var base64 = reader.result.replace(/^[^,]*,/,'');
      var encodedSize = base64.length;
      var chunks = util.chunkify(base64, chunkSize);

      var segment = 0;
      var segments = chunks.length;
      var uid = uid = util.rid32();

      // closure around segment
      var payload = _.bind(function() {
        return {
          uid: uid,
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            ext: ext
          },
          encodedSize: encodedSize,
          segment: segment,
          base64: chunks[segment],
        }
      }, this);

      // this function sends individual pieces of files.  On completion
      var sendChunk = _.bind(function (err, res) {
        if (err) {
          cbFail();
        }
        else if (segment < segments) {
          app.rpc.do('sendPartialFile', payload(), _.bind(function (err, res) {
            if (err) {
              this.newFileButtonSpin.stop();
              sendChunk(err, null);
            } else {
              cbProgress(((segment+1)/segments*100).toString() + '%')
              segment = segment + 1;
              sendChunk(null, res);
            }
          }, this));
        } else {
          cbSuccess();
          var args =  {
            uid: uid,
            channelNames: res.channelNames,
            fileName: file.name,
            timecolGuess: res.timecolGuess,
            cbUpload: cbUpload
          };
          _.delay(_.bind(function() {
            new Upload(app, args).render();
          }, this), 500)

        }
      }, this);

      sendChunk(null, null)

    },
  }
});
