/*
 * Common javascript functions for the client
 */

define([
  'jQuery',
  'Underscore',
  'rpc',
  'util',
], function ($, _, rpc, util) {

  /* upload - handles the first stage of uploading files to the server.
   * Takes a closure around 'file', 'this.app', and 'reader'
   * cbProgress is a function that takes a string percentage
   */
  return { 
  
    upload: function(file, reader, app, cbSuccess, 
                     cbFail, cbProgress, stopFcn) {

      var ext = file.name.split('.').pop();

      var chunkSize = 65536;
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
        console.log('sendingChunk');
        if (err) {
          cbFail(err);
          return false;
        }
        else if (stopFcn && stopFcn()) {
          return false;
        }
        else if (segment < segments) {
          app.rpc.do('sendPartialFile', payload(), _.bind(function (err, res) {
            if (err) {
              sendChunk(err, null);
            } else {
              cbProgress(((segment+1)/segments*100).toString() + '%')
              segment = segment + 1;
              sendChunk(null, res);
            }
          }, this));
        } else {
          cbSuccess(res);
          return true;
        }
      }, this);

      sendChunk(null, null)

    },
  }
});
