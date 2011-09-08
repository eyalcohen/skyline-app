/*!
 * Copyright 2011 Mission Motors
 */

define(['models/vehicle'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchVehicles',

    initialize: function () {
      this.view = new App.views.VehiclesView();
      this.view.render();
      this.loaded = _.bind(function (err, vehs) {
        if (!err) {
          this.view.render({ rows: vehs });
        }
      }, this);
      return this;
    },
    
    
  });
});

