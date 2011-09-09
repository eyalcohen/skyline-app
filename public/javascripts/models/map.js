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
            // SP: Join lat and lng points using the time
            // span from the lat point. This makes the
            // assumption that the array elements for lat and lng
            // returned by fetchSamples line up in time.
            this.points = [];
            _.each(latPnts, function (p, i) {
              p.lat = p.val;
              p.lng = lngPnts[i].val
              delete p.val;
              this.points.push(p);
              this.parallel()();
            }, this);
          },
          function (err) {
            if (!this.points || this.points.length === 0) {
              console.warn('Vehicle with id ' + vehicleId + ' has no mapable'+
                  ' coordinates for the time range requested.');
              return;
            } else {
              console.log(this.points);
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

