/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signin', 'destroy');
      App.subscribe('UserWasAuthenticated', this.destroy);
      App.subscribe('NotAuthenticated', this.render);
      return this;
    },

    setup: function () {
      this.email = $('input[name="user[email]"]', this.el);
      this.password = $('input[name="user[password]"]', this.el);
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
      var nofade;
      if (this.el.length) {
        this.remove();
        nofade = true;
      }
      this.el = App.engine('login.jade', opts).appendTo(App.regions.main);
      if (!nofade) {
        this.el.hide().fadeIn('fast');
      }
      this.setup();
      this.delegateEvents();
      this.email.val().trim() === '' ?
        this.email.focus() :
        this.password.focus();
      return this;
    },

    destroy: function () {
      this.remove();
      this.el = false;
    },

    signin: function (e) {
      e.preventDefault();
      App.api.signin(this.email.val(),
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
          return false;
        }
        App.store.set('user', user);
        App.user = App.store.get('user');
        this.el.fadeOut('fast', _.bind(function () {
          App.publish('UserWasAuthenticated');
        }, this));
      }, this));
      return this;
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

