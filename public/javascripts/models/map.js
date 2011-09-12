/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (spec) {      
      this.view = new App.views.MapView({ model: this });
      this.view.render({ empty: true });
      _.bindAll(this, 'load');
      App.subscribe('VehicleRequested', this.load);
      return this;
    },

    load: function (vehicleId, timeRange, validChannels) {
      var self = this;
      var canMap = _.indexOf(validChannels, 'gps.latitude_deg') !== -1 &&
          _.indexOf(validChannels, 'gps.longitude_deg') !== -1;
      if (canMap) {
        var points = [], self = this;
        Step(
          function () {
            App.api.fetchSamples(App.user, vehicleId, 'gps.latitude_deg', timeRange, this.parallel());
            App.api.fetchSamples(App.user, vehicleId, 'gps.longitude_deg', timeRange, this.parallel());
          },
          function (err, latPnts, lngPnts) {
            if (err) {
              throw err;
              return;
            }
            var points = [];
            var split = App.shared.splitSamplesByTime({ lat: latPnts, lng: lngPnts });
            split.forEach(function(p) {
              if ('lat' in p.val && 'lng' in p.val)
                points.push({ beg: p.beg, end: p.end,
                                   lat: p.val.lat.val, lng: p.val.lng.val });
            });
            if (points.length === 0) {
              console.warn('Vehicle with id ' + vehicleId + ' has no mapable'+
                  ' coordinates for the time range requested.');
            } else {
              self.set({
                points: points
              });
              self.view.render();
            }
          }
        );
      } else {
        console.warn('I can\'t map this!');
      }
      return this;
    },
    
  });
});

