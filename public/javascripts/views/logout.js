/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signout', 'destroy');
      App.subscribe('UserWasAuthenticated', this.render);
      //return App.subscribe('NotAuthenticated', this.destroy);
    },

    events: {
      'click #logout': 'signout',
    },

    render: function () {
      this.el = App.engine('logout.jade').appendTo(App.regions.header);
      this.delegateEvents();
      return this;
    },

    destroy: function () {
      this.remove();
    },

    signout: function (e) {
      console.log('signout ...');
      App.store.remove('user');
      App.user = null;
      App.publish('NotAuthenticated', [{
        first: true,
        report: 'You have been logged out.',
        type: 'message',
      }]);
    },

    checkInput: function (e) {
      var el = $(e.target);
      if (el.val().trim() !== '') {
        el.removeClass('cs-input-alert');
      }
      return this;
    },

  });
});

