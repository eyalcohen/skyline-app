/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'destroy');
      App.subscribe('UserWasAuthenticated', this.destroy);
      App.subscribe('NotAuthenticated', this.render);
      return this;
    },

    setup: function () {
      this.email = $('input[name="username"]', this.el);
      this.password = $('input[name="password"]', this.el);
      return this;
    },

    events: {
      'click #signin': 'signin',
      'keyup input[name="username"]': 'checkInput',
      'keyup input[name="password"]': 'checkInput',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        first: false,
        email: '',
        password: '',
        report: '',
        type: 'error',
        missing: {},
        have: {}
      });
      var nofade;
      if (this.el.length) {
        this.remove();
        nofade = true;
      }
      this.el = App.engine('login.jade', opts)
                   .appendTo(App.regions.main);
      if (!nofade)
        this.el.hide().fadeIn('fast');
      this.setup();
      this.delegateEvents();
      if('' === this.email.val().trim())
        this.email.focus();
      else this.password.focus();
      return this;
    },

    destroy: function () {
      this.remove();
      this.el = false;
    },

    signin: function (e) {
      var missing = {};
      var have = {};
      var email = this.email.val().trim();
      var password = this.password.val().trim();
      if ('' === email)
        missing.email = true
      else have.email = email;
      if ('' === password)
        missing.password = true;
      else have.password = password;
      if (!_.isEmpty(missing)) {
        e.preventDefault();
        App.publish('NotAuthenticated', [{
          report: 'Both fields are required.',
          type: 'error',
          missing: missing,
          have: have,
        }]);
        return false;
      } else return true;
    },

    checkInput: function (e) {
      var el = $(e.target);
      if (el.val().trim() !== '')
        el.removeClass('input-alert');
      return this;
    },

  });
});

