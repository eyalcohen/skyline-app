/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (spec) {      
      this.view = new App.views.GraphView({ model: this });
      this.view.render({ empty: true });
      _.bindAll(this, 'load');
      App.subscribe('VehicleRequested', this.load);
      return this;
    },

    load: function (vehicleId, timeRange, validChannels) {
      // console.log(validChannels);
      var points = [], self = this;
      Step(
        function () {
          // App.api.fetchSamples(App.user, vehicleId, 'pm/packTemperature', timeRange, this.parallel());
          App.api.fetchSamples(App.user, vehicleId, 'pm/packCurrent100ms', timeRange, this.parallel());
        },
        function (err, channel) {
          if (err) {
            throw err;
            return;
          }
          if (!channel || channel.length === 0) {
            console.warn('Vehicle with id ' + vehicleId + ' has no graphable'+
                ' data for the time range requested.');
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
        }
      );
      return this;
    },

  });
});

