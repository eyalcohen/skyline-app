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
      this.view = new App.views.NotificationsView(args);
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        this.view.render();
      }, this);
      return this;
    },
    
  });
});

