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
      var self = this;
      var canMap = _.indexOf(validChannels, 'gps.latitude_deg') !== -1 &&
          _.indexOf(validChannels, 'gps.longitude_deg') !== -1;
      if (canMap) {
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
            console.log(split);
            split.forEach(function(p) {
              if ('lat' in p.val && 'lng' in p.val)
                points.push({ beg: p.beg, end: p.end,
                                   lat: p.val.lat.val, lng: p.val.lng.val });
            });
            self.points = points;
            if (!self.points || self.points.length === 0) {
              console.warn('Vehicle with id ' + vehicleId + ' has no mappable' +
                  ' coordinates for the time range requested.');
              return;
            } else {
              console.log(self.points);
              // this.view.parse();
            }
          }
        );
      } else {
        console.warn('I can\'t map this!');
      }
    },
    
  });
});

