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
      _.bindAll(this, 'fetch');
      App.subscribe('ChannelRequested-' + args.vehicleId, this.fetch);
      return this;
    },

    fetch: function (channelName, timeRange) {
      this.view.render({ loading: true });
      var points = [], self = this;
      App.api.fetchSamples(App.user, self.attributes.vehicleId, channelName, timeRange,
          function (err, channel) {
        if (err) {
          throw err;
          return;
        }
        if (!channel || channel.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId + ' has no '+
              channelName + ' data for the time range requested.');
          self.view.render({ empty: true });
        } else {
          var data = [];
          _.each(channel, function (pnt) {
            data.push([pnt.beg, pnt.val]);
          });
          self.set({
            data: data
          });
          self.view.render();
        }
      });

      return this;
    },

  });
});

