/*
 * Save view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/save.html'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, template) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    className: 'save',
    working: false,
    
    // Module entry point:
    initialize: function (app, options) {
      
      // Save app reference.
      this.app = app;
      this.options = options;

      // Client-wide subscriptions
      this.subscriptions = [];

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Add placeholder shim if need to.
      if (Modernizr.input.placeholder)
        this.$('input').placeholder();

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .save-form input[type="submit"]': 'save',
      'keyup input[name="name"]': 'update',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.saveForm = $('.save-form');
      this.saveInput = $('input[name="name"]', this.saveForm);
      this.saveSubmit = $('input[type="submit"]', this.saveForm);
      this.saveError = $('.modal-error', this.saveForm);
      this.saveButtonSpin = new Spin($('.button-spin', this.el), {
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

      // Focus cursor.
      _.delay(_.bind(function () {
        this.focus();
      }, this), 0);

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

    // Update save button status
    update: function (e) {
      if (this.saveInput.val().trim().length === 0)
        this.saveSubmit.attr({disabled: 'disabled'});
      else
        this.saveSubmit.attr({disabled: false});
    },

    save: function (e) {
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Start load indicator.
      this.saveButtonSpin.start();
      this.saveSubmit.addClass('loading');

      // Grab the form data.
      var payload = this.saveForm.serializeObject();

      // Client-side form check.
      var check = util.ensure(payload, ['name']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = $('input[name="' + m + '"]', this.saveForm);
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        this.saveInput.text(msg);

        return;
      }

      // Add other data.
      var state = store.get('state');
      _.extend(payload, {
        datasets: state.datasets,
        time: state.time
      });

      // Create the view.
      rest.post('/api/views', payload, _.bind(function (err, res) {

        // Start load indicator.
        this.saveButtonSpin.stop();
        this.saveSubmit.removeClass('loading').attr({disabled: 'disabled'});
        this.saveInput.val('');

        if (err) {
          this.newFileError.text(err);
          this.working = false;
          this.saveInput.addClass('input-error');
          this.focus();
          return;
        }

        // Publish new dataset.
        mps.publish('view/new', [res]);

        // Show alert
        mps.publish('flash/new', [{
          message: 'Successfully saved a new data mashup: "' + res.name + '"',
          level: 'alert',
          sticky: false
        }]);

        // Close the modal.
        $.fancybox.close();

        // Ready for more.
        this.working = false;

        // Update URL.
        var route = [this.app.profile.user.username,
            'views', res.slug].join('/');
        this.app.router.navigate('/' + route, {trigger: false, replace: true});

      }, this));

      return false;
    },

  });
});
