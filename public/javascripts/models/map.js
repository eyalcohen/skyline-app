/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.MapView(args);
      this.view.render({ waiting: true });
      _.bindAll(this, 'fetch');
      App.subscribe('MapRequested-' + args.vehicleId, this.fetch);
      return this;
    },

    fetch: function (timeRange) {
      this.view.render({ loading: true });
      var self = this, canMap = timeRange.endTime - timeRange.beginTime > 0;
      if (canMap) {
        var points = [], self = this;
        Step(
          function () {
            App.api.fetchSamples(self.attributes.vehicleId, 
                  'gps.latitude_deg', timeRange, this.parallel());
            App.api.fetchSamples(self.attributes.vehicleId, 
                  'gps.longitude_deg', timeRange, this.parallel());
          },
          function (err, latPnts, lngPnts) {
            if (err) {
              throw err;
              return;
            }
            var points = [];
            var split = App.shared.splitSamplesByTime({ lat: latPnts, lng: lngPnts });
            split.forEach(function (p) {
              if ('lat' in p.val && 'lng' in p.val)
                points.push({ beg: p.beg, end: p.end,
                                   lat: p.val.lat.val, lng: p.val.lng.val });
            });
            if (points.length === 0) {
              console.warn('Vehicle with id ' + vehicleId + ' has no mappable' +
                  ' coordinates for the time range requested.');
              self.view.render({ empty: true });
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
        this.view.render({ empty: true });
      }
      return this;
    },
    
  });
});

