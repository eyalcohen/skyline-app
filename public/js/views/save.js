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
  'text!../../../templates/save.html',
  'Spin'
], function ($, _, Backbone, Modernizr, mps, rest, util, template, Spin) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    className: 'save',
    
    // Module entry point:
    initialize: function (app, options) {
      
      // Save app reference.
      this.app = app;
      this.options = options;

      if (this.options && this.options.meta) {
        this.options.meta.dataset_cnt = this.options.datasets.length;
        this.options.meta.channel_cnt = 0;
        _.each(this.options.datasets, _.bind(function (d) {
          this.options.meta.channel_cnt += d.channels.length;
        }, this));
        delete this.options.meta.width;
      }

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

      // Init the load indicator.
      this.spin = new Spin(this.$('#save_spin'), {
        lines: 17, // The number of lines to draw
        length: 12, // The length of each line
        width: 4, // The line thickness
        radius: 18, // The radius of the inner circle
        corners: 1, // Corner roundness (0..1)
        rotate: 0, // The rotation offset
        direction: 1, // 1: clockwise, -1: counterclockwise
        color: '#808080', // #rgb or #rrggbb
        speed: 1.5, // Rounds per second
        trail: 60, // Afterglow percentage
        shadow: false, // Whether to render a shadow
        hwaccel: false, // Whether to use hardware acceleration
        className: 'spinner', // The CSS class to assign to the spinner
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        top: 'auto', // Top position relative to parent in px
        left: 'auto' // Left position relative to parent in px
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #save': 'save'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.saveForm = $('#save_form');

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

    save: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = this.saveForm.serializeObject();

      // Client-side form check.
      var errorMsg = $('.save-error', this.saveForm);
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
        errorMsg.text(msg);

        return;
      }

      // All good, show spinner.
      this.$('.save-inner > div').hide();
      this.spin.start();

      // Add other data.
      _.extend(payload, this.options);

      // Do the API request.
      rest.post('/api/views', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          this.spin.stop();
          this.$('.save-inner > div').show();

          // Set the error display.
          errorMsg.text(err);

          // Clear fields.
          $('input[type="text"]', this.saveForm).val('')
              .addClass('input-error');
          this.focus();
          
          return;
        }

        // Route to profile.
        var route = [this.app.profile.user.username, 'views', data.slug].join('/');
        this.app.router.navigate('/' + route, {trigger: true});

        // Stop spinner.
        this.spin.stop();

        // Close the modal.
        $.fancybox.close();
        
      }, this));

      return false;
    },

  });
});
