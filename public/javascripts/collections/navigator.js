/*!
 * Copyright 2011 Mission Motors
 */

define(['models/notification'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchNotifications',

    initialize: function (args) {
      if (!args) args = {};
      this.readOpts = { vehicleId: args.vehicleId };
      _.extend(args, { collection: this });
      this.view = new App.views.NavigatorView(args);
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        var empty = this.models.length === 0;
        this.view.render({ empty: false });
      }, this);
      return this;
    },

  });
});

