/*!
 * Copyright 2011 Mission Motors
 */

define(['models/notification'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchNotifications',

    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { collection: this });
      this.tabModel = args.tabModel;
      this.readOpts = { vehicleId: args.vehicleId };
      this.view = new App.views.NotificationsView(args);
      this.view.render({
        title: args.title,
        loading: true,
        singleVehicle: args.singleVehicle,
      });
      this.loaded = _.bind(function () {
        this.view.render({
          title: args.title,
          singleVehicle: args.singleVehicle,
        });
      }, this);
      return this;
    },

  });
});

