/*!
 * Copyright 2011 Mission Motors
 */

define(['models/vehicle'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchVehicles',

    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { collection: this });
      this.view = new App.views.VehiclesView(args);
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        this.view.render();
      }, this);
      return this;
    },

  });
});

