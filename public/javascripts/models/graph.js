/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.GraphView(args);
      this.view.render({ waiting: true });
      this.set({ 
        data: [],
        labels: [],
        units: [],
        colors: [],
      });
      this.colorCnt = 0;
      _.bindAll(this, 'fetch');
      App.subscribe('ChannelRequested-' + args.vehicleId, this.fetch);
      return this;
    },

    fetch: function (channel, timeRange) {
      var clear = this.get('data').length === 0;
      if (clear)
        this.view.render({ loading: true });
      var points = [], self = this;
      App.api.fetchSamples(self.attributes.vehicleId, channel.channelName, timeRange,
          function (err, channelData) {
        if (err) {
          throw err;
          return;
        }
        if (!channelData || channelData.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId + ' has no '+
              channel.channelName + ' data for the time range requested.');
          if (clear)
            self.view.render({ empty: true });
        } else {
          var data = [];
          _.each(channelData, function (pnt) {
            data.push([pnt.beg / 1000, pnt.val]);
            if (pnt.end !== pnt.beg)
              data.push([pnt.end / 1000, pnt.val]);
          });
          App.shared.mergeOverlappingSamples(data);
          self.get('data').push(data);
          var label = channel.units ?
              channel.title + ' (' + channel.units + ')' :
              channel.title;
          self.get('labels').push(label);
          self.get('units').push(channel.units || '');
          self.get('colors').push(self.colorCnt);
          if (self.get('data').length > 2) {
            self.get('data').shift();
            self.get('labels').shift();
            self.get('units').shift();
            self.get('colors').shift();
          }
          if (clear) {
            self.view.render({}, function () {
              self.view.draw({ range: timeRange });
            });
          } else {
            self.view.draw({ range: timeRange });
          }
          self.colorCnt++;
          if (self.colorCnt > 4)
            self.colorCnt = 0;
        }
      });

      return this;
    },

  });
});

