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
  'text!../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Spin, Profile,
      template, confirm) {

  return Backbone.View.extend({
    
    // The DOM target element for this page.
    className: 'settings',

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;
      
      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Profile(this.app.profile.content.page);

      // Set page title
      this.app.title('Settings', '');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
      'click .demolish': 'demolish'
    },

    // Misc. setup.
    setup: function () {

      // Save field contents on blur.
      this.$('textarea, input[type="text"], input[type="checkbox"]')
          .change(_.bind(this.save, this))
          .keyup(function (e) {
        var field = $(e.target);
        var label = $('label[for="' + field.attr('name') + '"]');
        var saved = $('.settings-saved', label.parent().parent());

        if (field.val().trim() !== field.data('saved'))
          saved.hide();

        return false;
      });

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

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
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
      var label = $('label[for="' + name + '"]');
      var saved = $('.settings-saved', label.parent().parent());
      var errorMsg = $('.settings-error', label.parent().parent()).hide();
      var val = util.sanitize(field.val());

      // Handle checkbox.
      if (field.attr('type') === 'checkbox')
        val = field.is(':checked');

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Check for email.
      if (payload.primaryEmail && !util.isEmail(payload.primaryEmail)) {
        errorMsg.text('Please use a valid email address.').show();
        return false;
      }

      // Now do the save.
      rest.put('/api/users/' + this.app.profile.user.username, payload,
          _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          errorMsg.text(err.message).show();

          // Clear fields.
          if (err === 'Username exists')
            field.addClass('input-error').focus();

          return false;
        }

        // Update profile.
        _.extend(this.app.profile.user, payload);

        // Save the saved state and show indicator.
        field.data('saved', val);
        saved.show();

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
      $('#m_cancel').click(function (e) {
        $.fancybox.close();
      });
      $('#m_yes').click(_.bind(function (e) {

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

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});