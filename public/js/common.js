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

    // call with 'this' pointing to element
    drawChannel: function(channel) {
      var li = this.$('#' + channel.channelName);
      var selector = $('.event-channel-svg', li);
      var width = selector.width();
      var height = selector.height();

      this.app.cache.fetchSamples(channel.channelName, channel.beg, channel.end,
          width, _.bind(function(samples) {

        selector.empty();

        if (_.isEmpty(samples)) return;

        var t_0 = samples[0].time;
        var t_max = _.last(samples).time;
        var t_diff = t_max - t_0;

        var v_max = _.max(_.pluck(samples, 'avg'));
        var v_min = _.min(_.pluck(samples, 'avg'));
        var v_diff = v_max - v_min;

        var path = d3.svg.area()
            .x(function (s, i) {
              if (t_diff === 0) {
                return i === 0 ? 0: width;
              } else {
                return ((s.time - t_0) / t_diff * width);
              }
            })
            .y0(function () {
              return height;
            })
            .y1(function (s) {
              return v_diff === 0 ? v_max: height - ((s.avg - v_min) / v_diff * height);
            })
            .interpolate('linear');

        d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(samples))
            .attr('class', 'area')
            .attr('fill', '#000000');
      }, this));
    },

    upload: function(file, reader, app, cb,
                     cbProgress, stopFcn) {

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
        if (err) {
          cb(err);
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
          cb(null, res);
          return true;
        }
      }, this);

      sendChunk(null, null)

    }
  }
});
