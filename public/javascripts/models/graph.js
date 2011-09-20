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
      });
      _.bindAll(this, 'fetch');
      App.subscribe('ChannelRequested-' + args.vehicleId, this.fetch);
      return this;
    },

    fetch: function (channelName, timeRange) {
      var clear = this.get('data').length === 0;
      if (clear)
        this.view.render({ loading: true });
      var points = [], self = this;
      App.api.fetchSamples(self.attributes.vehicleId, channelName, timeRange,
          function (err, channel) {
        if (err) {
          throw err;
          return;
        }
        if (!channel || channel.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId + ' has no '+
              channelName + ' data for the time range requested.');
          if (clear)
            self.view.render({ empty: true });
        } else {
          var data = [];
          _.each(channel, function (pnt) {
            data.push([pnt.beg, pnt.val]);
            if (pnt.end !== pnt.beg)
              data.push([pnt.end, pnt.val]);
          });
          self.get('data').push(data);
          self.get('labels').push(channelName);
          if (clear) {
            self.view.render({}, function () {
              self.view.draw({
                label: channelName,
              });
            });
          } else {
            self.view.draw({
              label: channelName,
            });
          }
        }
      });

      return this;
    },

  });
});

