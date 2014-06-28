/*
 * Settings view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'models/user',
  'text!../../templates/settings.html',
  'text!../../templates/profile.header.html',
  'text!../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Spin, Profile, template, header, confirm) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      
      this.on('rendered', this.setup, this);
    },

    render: function () {

      // Use a model for the main content.
      this.model = new Profile(this.app.profile.content.page);

      // Set page title
      this.app.title('Skyline | ' + this.app.profile.user.displayName + ' - Settings');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Render title.
      this.title = _.template(header).call(this, {settings: true});

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .demolish': 'demolish'
    },

    setup: function () {

      // Save field contents on blur.
      this.$('textarea, input[type="text"], input[type="checkbox"], input[type="radio"]')
          .change(_.bind(this.save, this));

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Handle username.
      this.$('input[name="username"]').bind('keydown', function (e) {
        if (e.which === 32) return false;
      }).bind('keyup', function (e) {
        $(this).val(_.str.slugify($(this).val()).substr(0, 30));
      });

      return this;
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

    // Save the field.
    save: function (e) {
      var field = $(e.target);
      var name = field.attr('name');
      var val = util.sanitize(field.val());

      // Handle checkbox.
      if (field.attr('type') === 'checkbox') {
        val = field.is(':checked');
      }

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Check for email.
      if (payload.primaryEmail && !util.isEmail(payload.primaryEmail)) {
        mps.publish('flash/new', [{
          err: {message: 'Please use a valid email address.'},
          level: 'error'}
        ]);
        return false;
      }

      // Now do the save.
      rest.put('/api/users/' + this.app.profile.user.username, payload,
          _.bind(function (err, data) {
        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);

          // Show error highlight.
          if (err === 'Username exists') {
            field.addClass('input-error').focus();
          }

          return false;
        }

        // Update profile.
        _.extend(this.app.profile.user, payload);

        // Save the saved state and show indicator.
        field.data('saved', val);

        // Show saved status.
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);

      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'I want to permanently delete my account.',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the user.
        rest.delete('/api/users/' + this.app.profile.user.username,
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // Logout client-side.
          mps.publish('user/delete');

          // Close the modal.
          $.fancybox.close();

          // Route to home.
          this.app.router.navigate('/', {trigger: true});

        }, this));
      }, this));

      return false;
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});
