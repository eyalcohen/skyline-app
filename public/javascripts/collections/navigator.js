/*!
 * Copyright 2011 Mission Motors
 */

define(['models/event'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchEvents',

    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { collection: this });
      this.readOpts = { vehicleId: args.vehicleId };
      this.view = new App.views.NavigatorView(args);
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        this.view.render();
      }, this);
      return this;
    },

  });
});

