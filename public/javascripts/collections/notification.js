/*!
 * Copyright 2011 Mission Motors
 */

define(['models/notification'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchNotifications',

    initialize: function () {
      this.view = new App.views.NotificationsView({ collection: this });
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        this.view.render();
      }, this);
      return this;
    },
    
  });
});

