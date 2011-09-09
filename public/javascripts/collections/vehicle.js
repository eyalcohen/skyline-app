/*!
 * Copyright 2011 Mission Motors
 */

define(['models/vehicle'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchVehicles',

    initialize: function () {
      this.view = new App.views.VehiclesView({ collection: this });
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        this.view.render();
      }, this);
      return this;
    },

  });
});

