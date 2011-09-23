/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.TreeView(args);
      return this;
    },

    fetch: function () {
      var self = this;
      self.view.render({ loading: true });
      App.api.fetchChannelTree(self.attributes.vehicleId,
          function (err, data) {
        if (err) { throw err; return; }
        if (!data || data.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId +
              ' has never been seen before!');
        } else {
          self.set({
            data: data,
          });
          self.view.render();

          var latRanges = [];
          _.each(data, function (d) {
            if (d.shortName === 'gps.') {
              _.each(d.sub, function (s) {
                if (s.channelName === 'gps.latitude_deg') {
                  latRanges = s.valid;
                }
              });
            }
          });

          var len = latRanges.length, i = 1,
              range = {};
          if (len > 0) {
            do {
              range.beginTime = latRanges[len - i].beg;
              range.endTime = latRanges[len - i].end;
              i++;
              if (i > len) {
                range = {};
                break;
              }
            } while (range.endTime - range.beginTime <= 0);
          }
          
          // if (self.attributes.vehicleId === 1088675181) {
          //   graphRange = {
          //     beginTime: new Date().getTime() - 60 * 60 * 24 * 1 * 1000,
          //     endTime: new Date().getTime() * 1000,
          //   };
          // } else {
          //   graphRange = range;
          // }
          
          App.publish('MapRequested-' + self.attributes.vehicleId, [range]);
          App.publish('ChannelRequested-' + self.attributes.vehicleId, [{
            channelName: 'gps.speed_m_s',
            humanName: 'GPS Speed',
            shortName: 'speed_m_s',
            type: 'float',
            units: 'm/s',
            title: 'GPS Speed',
          }, range]);
        }
      });
      return this;
    },

  });
});

