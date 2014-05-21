/*
 * Forgot password view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/forgot.html'
], function ($, _, Backbone, mps, rest, util, Spin, template) {
  return Backbone.View.extend({

    className: 'forgot',
    working: false,

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        modal: true
      });

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .modal-close': 'close',
      'click .forgot-form input[type="submit"]': 'send',
      'keyup input[name="email"]': 'update',
    },

    setup: function () {

      // Save refs.
      this.forgotForm = $('.forgot-form');
      this.forgotInput = $('input[name="email"]', this.forgotForm);
      this.forgotSubmit = $('input[type="submit"]', this.forgotForm);
      this.forgotError = $('.modal-error', this.forgotForm);
      this.forgotButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Handle error display.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Focus cursor initial.
      _.delay(_.bind(function () { this.forgotInput.focus(); }, this), 0);

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]:visible'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
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

    close: function (e) {
      $.fancybox.close();
    },

    // Update forgot button status
    update: function (e) {
      if (this.forgotInput.val().trim().length === 0)
        this.forgotSubmit.attr({disabled: 'disabled'});
      else
        this.forgotSubmit.attr({disabled: false});
    },

    send: function (e) {
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Grab the form data.
      var payload = {email: this.forgotInput.val().trim()};

      // Client-side form check.
      var check = util.ensure(payload, ['email']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[name="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        this.forgotError.text(msg);
        this.working = false;

        return false;
      }
      if (!util.isEmail(payload.email)) {

        // Set the error display.
        this.forgotInput.val('').addClass('input-error').focus();
        var msg = 'Please use a valid email address.';
        this.forgotError.text(msg);
        this.working = false;

        return false;
      }

      // Start load indicator.
      this.forgotButtonSpin.start();
      this.forgotSubmit.addClass('loading');

      // Do the API request.
      rest.post('/api/users/forgot', payload, _.bind(function (err, data) {
        
        // Start load indicator.
        this.forgotButtonSpin.stop();
        this.forgotSubmit.removeClass('loading').attr({disabled: 'disabled'});
        this.forgotInput.val('');
        this.working = false;

        if (err) {

          // Set the error display.
          if (err.code === 404)
            this.forgotError.text('Sorry, we could not find your account.');
          else if (err.message === 'No password') {
            var provider = _.str.capitalize(err.data.provider);
            this.forgotError.html('Oops, this account was created via ' + provider
                + '. <a href="/auth/' + err.data.provider
                + '">Reconnect with ' + provider + '</a>.');
          } else this.forgotError.text(util.formatError(err));

          // Clear fields.
          this.forgotInput.addClass('input-error');
          this.focus();

          return;
        }

        // Wait a little then close the modal.
        $.fancybox.close();

        // Inform user.
        mps.publish('flash/new', [{
          message: 'Please check your inbox for a link to reset your password.',
          level: 'alert'
        }, true]);

        // Ready for more.
        this.working = false;
      }, this));

      return false;
    },

    cancel: function (e) {
      e.preventDefault();
      $.fancybox.close();
    }

  });
});
