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

      // Determine if this is a dataset or view.
      var state = store.get('state');
      this.resource = state.author_id ? 'view': 'dataset';

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
      _.delay(_.bind(function () { this.focus(); }, this), 0);

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

      // Prevent multiple saves at the same time.
      if (this.working) return false;
      this.working = true;

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
        this.saveError.text(msg);
        this.working = false;

        return false;
      }

      if (this.resource === 'dataset') {
        
        // Dataset has title, not name.
        payload.title = payload.name;
        delete payload.name;

        // Creating a dataset in this way will always be a fork,
        // so need to include the parent.
        var dids = _.keys(state.datasets);
        if (dids.length === 0) {

          // Set the error display.
          var msg = 'No dataset found.';
          this.saveError.text(msg);
          this.working = false;

          return false;
        }
        payload.parent_id = dids[0];
      } else {

        // Add other data about this view from state.
        _.extend(payload, {
          datasets: state.datasets,
          time: state.time,
          lineStyleOptions: state.lineStyleOptions
        });

        // Add parent if this is a fork.
        if (this.options.fork)
          payload.parent_id = state.id;
      }

      // Start load indicator.
      this.saveButtonSpin.start();
      this.saveSubmit.addClass('loading');

      // Create the resource.
      rest.post('/api/' + this.resource + 's', payload,
          _.bind(function (err, res) {

        // Start load indicator.
        this.saveButtonSpin.stop();
        this.saveSubmit.removeClass('loading').attr({disabled: 'disabled'});
        this.saveInput.val('');

        if (err) {
          this.saveError.text(err);
          this.working = false;
          this.saveInput.addClass('input-error');
          this.focus();
          return;
        }

        // Publish new dataset.
        var now = new Date().toISOString();
        this.app.profile.content.page = res;
        _.extend(state, {
          author_id: res.author.id,
          comments: [],
          comments_cnt: 0,
          id: res.id,
          created: now,
          updated: now
        });
        if (res.name) state.name = res.name;
        if (res.title) state.title = res.title;
        if (res.slug) state.slug = res.slug;
        store.set('state', state);
        mps.publish('view/new', [res]);

        // Show alert
        _.delay(_.bind(function () {
          var type, name;
          if (this.resource === 'view') {
            type = 'mashup';
            name = res.name;
          } else {
            type = 'source';
            name = res.title;
          }
          var verb = this.options.fork ? 'forked': 'saved';
          mps.publish('flash/new', [{
            message: 'You ' + verb + ' a data ' + type + ': "' + name + '"',
            level: 'alert',
            sticky: false
          }]);
        }, this), 500);

        // Close the modal.
        $.fancybox.close();

        // Ready for more.
        this.working = false;

        // Update URL.
        var route, trigger, replace;
        if (this.resource === 'view') {
          route = [this.app.profile.user.username, 'views', res.slug].join('/');
          trigger = false;
          replace = true;
        } else {
          route = [this.app.profile.user.username, res.id].join('/');
          trigger = true;
          replace = false;
        }
        this.app.router.navigate('/' + route,
            {trigger: trigger, replace: replace});

      }, this));

      return false;
    },

  });
});
