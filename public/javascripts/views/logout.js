/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signout', 'destroy');
      App.subscribe('UserWasAuthenticated', this.render);
      App.subscribe('NotAuthenticated', this.destroy);
      return this;
    },

    events: {
      'click #logout': 'signout',
    },

    render: function () {
      this.el = App.engine('logout.jade', { email: App.user.email }).appendTo(App.regions.menu);
      this.delegateEvents();
      return this;
    },

    destroy: function () {
      this.remove();
      this.el = false;
      return this;
    },

    signout: function (e) {
      App.store.remove('user');
      App.user = null;
      App.publish('NotAuthenticated', [{
        first: true,
        report: 'You have been logged out.',
        type: 'message',
      }]);
      return this;
    },

  });
});

