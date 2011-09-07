/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
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

      // App.subscribe('UserWasAuthenticated', App.loadUser);
      // _.each(this.models, function (m) {
      //   
      // }, this);
    },
    
    
  });
});

