/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signout', 'destroy');
      return [App.subscribe('UserWasAuthenticated', this.render),
          App.subscribe('NotAuthenticated', this.destroy)];
    },

    events: {
      'click #logout': 'signout',
    },

    render: function () {
      this.el = App.engine('logout.jade').appendTo(App.regions.menu);
      this.delegateEvents();
      return this;
    },

    destroy: function () {
      this.remove();
      this.el = false;
    },

    signout: function (e) {
      App.store.remove('user');
      App.user = null;
      App.publish('NotAuthenticated', [{
        first: true,
        report: 'You have been logged out.',
        type: 'message',
      }]);
    },

  });
});

