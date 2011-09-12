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
            if (latPnts.length !== lngPnts.length) {
              console.warn("Latitude and longitude counts don't match!");
              return;
            }
            // SP: Join lat and lng points using the time
            // span from the lat point. This makes the
            // assumption that the array elements for lat and lng
            // returned by fetchSamples line up in time.
            _.each(latPnts, function (p, i) {
              p.lat = p.val;
              p.lng = lngPnts[i].val
              delete p.val;
              points.push(p);
              this.parallel()();
            }, this);
          },
          function (err) {
            if (!points || points.length === 0) {
              console.warn('Vehicle with id ' + vehicleId + ' has no mapable'+
                  ' coordinates for the time range requested.');
              return;
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

