/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.GraphView(args);
      this.view.render({ loading: true });
      _.bindAll(this, 'load');
      // App.subscribe('VehicleRequested', this.load);
      return this;
    },

    load: function (vehicleId, timeRange, validChannels) {
      var points = [], self = this;
      App.api.fetchSamples(vehicleId, 'accel.x_m_s2', timeRange,
          function (err, channel) {
        if (err) {
          throw err;
          return;
        }
        if (!channel || channel.length === 0) {
          console.warn('Vehicle with id ' + vehicleId + ' has no graphable' +
              ' data for the time range requested.');
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

