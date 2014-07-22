/*
 * Signin view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/signin.html'
], function ($, _, Backbone, mps, rest, util, Spin, template) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Log In');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Init the load indicators.
      this.$('.button-spin').each(function (el) {
        var opts = {
          color: '#3f3f3f',
          lines: 13,
          length: 3,
          width: 2,
          radius: 6,
        };
        if ($(this).hasClass('button-spin-white')) {
          opts.color = '#fff';
        }
        $(this).data('spin', new Spin($(this), opts));
      });

      // Show the spinner when connecting.
      this.$('.connect-button').click(_.bind(function (e) {
        $('.button-spin', $(e.target).parent()).data().spin.start();
        $(e.target).addClass('loading');
      }, this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .forgot-password': 'forgot',
      'click .navigate': 'navigate',
      'click .signin-submit': 'signin'
    },

    setup: function () {

      // Save refs.
      this.signinTarget = this.$('#signin_target');
      this.signinButton = this.$('.signin-submit');

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) {
          $(i).focus();
        }
        return empty;
      });
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    signin: function (e) {
      e.preventDefault();

      // Sanitize.
      this.$('input[type!="submit"]:visible').each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Grab the form data.
      var payload = {
        username: this.$('.signin-username').val().trim(),
        password: this.$('.signin-password').val().trim()
      };

      // Client-side form check.
      var spin = this.$('.button-spin').data().spin;
      var errorMsg = this.$('.page-error');
      var check = util.ensure(payload, ['username', 'password']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('.signin-' + m);
        field.val('').addClass('input-error');
        if (i === 0) {
          field.focus();
        }
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return false;
      }

      // All good, show spinner.
      spin.start();
      this.signinButton.addClass('loading');

      // Do the API request.
      rest.post('/api/users/auth', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          spin.stop();
          this.signinButton.removeClass('loading');

          // Set the error display.
          errorMsg.text(err.message + '.');

          // Clear fields.
          this.$('input[type="text"], input[type="password"]').val('')
              .addClass('input-error');
          this.focus();

          return;
        }

        // Reload the current page.
        this.refresh();
      }, this));

      return false;
    },

    refresh: function () {
      var frag = Backbone.history.fragment;
      Backbone.history.fragment = null;
      window.location.href = '/';
    },

    forgot: function (e) {
      e.preventDefault();
      mps.publish('modal/forgot/open');
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
