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
      this.dependents = args.dependents;
      this.loaded = args.loaded || function () {};
      return this;
    },

  });
});

