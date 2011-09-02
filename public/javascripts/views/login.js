/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define(function () {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signin');
      return App.subscribe('NotAuthenticated', this.render);
    },

    setup: function () {
      this.email = $('input[name="user[email]"]', this.el);
      this.password = $('input[name="user[password]"]', this.el)
      return this;
    },

    events: {
      'click #login': 'signin',
      'keyup input[name="user[email]"]': 'checkInput',
      'keyup input[name="user[password]"]': 'checkInput',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        first: false,
        email: '',
        password: '',
        report: '',
        type: 'error',
        missing: []
      });
      if (this.el.length)
        this.el.empty();
      this.el = App.engine('login.jade', opts).appendTo($('#main'));
      this.setup();
      this.delegateEvents();
      this.email.val().trim() === '' ?
        this.email.focus() :
        this.password.focus();
      return this;
    },

    signin: function (e) {
      e.preventDefault();
      return App.api.signin(this.email.val(),
          this.password.val(),
          _.bind(function (err, user) {
        if (err !== null) {
          switch (err.code) {
            case 'MISSING_FIELD':
              App.publish('NotAuthenticated', [{
                email: err.email,
                password: err.password,
                report: err.message,
                missing: err.missing
              }]);
              break;
            case 'BAD_AUTH':
              App.publish('NotAuthenticated', [{
                email: err.email,
                report: err.message
              }]);
              break;
          }
          return;
        }
        App.cache.set('user', user);
        App.user = App.cache.get('user');
        return this.el.fadeOut('fast', _.bind(function () {
          this.remove();
          App.publish('UserWasAuthenticated');
        }, this));
      }, this));
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

