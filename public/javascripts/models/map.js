/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (spec) {      
      this.view = new App.views.MapView();
      this.view.render({ empty: true });
      _.bindAll(this, 'load');
      App.subscribe('VehicleRequested', this.load);
      // this.set({
      //
      // });
      return this;
    },

    load: function (vehicleId, timeRange, validChannels) {
      var canMap = _.indexOf(validChannels, 'gps.latitude_deg') !== -1 &&
          _.indexOf(validChannels, 'gps.longitude_deg') !== -1;
      if (canMap) {
        console.log('I can map this!');
        App.api.fetchSamples(App.user, vehicleId, ['gps.latitude_deg', 'gps.longitude_deg'], timeRange,
            function (err, points) {
          console.log(err, points);
          if (err) {
            throw err;
            return;
          } else if (!points || points.length === 0) {
            console.warn('Vehicle with id ' + vehicleId + ' has no mapable'+
                ' coordinates for the time range requested.');
            return;
          } else {
            console.log(points);
          }
        });
      } else {
        console.log('I can\'t map this!');
      }
    },
    
  });
});

