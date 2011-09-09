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
    
    load: function (vehicleId) {
      console.log('sdvdsv');
      App.api.fetchSamples(App.user, vehicleId, '_schema', {}, function (err, cycles) {
        console.log(err, cycles);
      });
    }
    
  });
});

