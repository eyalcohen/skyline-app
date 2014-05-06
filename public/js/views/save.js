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
      this.options = options || {};

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
        padding: 0,
        modal: true
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
      'click .modal-close': 'close',
      'click .save-form input[type="submit"]': 'save',
      'keyup input[name="name"]': 'update',
      'click .save-private': 'checkPrivate'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.saveForm = this.$('.save-form');
      this.saveInput = $('input[name="name"]', this.saveForm);
      this.saveDescription = $('textarea[name="description"]', this.saveForm);
      this.saveTags = $('input[name="tags"]', this.saveForm);
      this.saveSubmit = $('input[type="submit"]', this.saveForm);
      this.saveError = $('.modal-error', this.saveForm);
      this.saveButtonSpin = new Spin(this.$('.button-spin'), {
        color: '#fff',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });
      this.privateButton = this.$('.save-private');

      // Handle textarea.
      this.saveDescription.bind('keyup', $.fancybox.reposition).autogrow();

      // Check if chart contains any private datasets.
      this.allowPublic = !_.find(this.app.profile.content.datasets.items,
          function (d) { return d.public === false; });
      // If forking a dataset, only the first (leader) dataset matters.
      if (this.options.target && this.options.target.type === 'dataset'
          && this.app.profile.content.datasets.items[0].public !== false)
        this.allowPublic = true;
      if (!this.allowPublic) {
        this.privateButton.attr({checked: true, disabled: true});
        this.checkPrivate();
        this.privateButton.addClass('disabled');
      }

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

    close: function (e) {
      $.fancybox.close();
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
      var payload = {
        name: util.sanitize(this.saveInput.val()),
        tags: util.sanitize(this.saveTags.val()),
        description: util.sanitize(this.saveDescription.val())
      };

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

      // Handle private / public.
      payload.public = !this.allowPublic ?
          false: !this.$('.save-private').is(':checked');

      // If there is no target, we are creating a new view from the current state.
      var resource, verb, type, name = payload.name;
      if (!this.options.target) {
        resource = 'views';
        verb = 'saved';
        type = 'view';

        // Add state data.
        var state = store.get('state');
        _.extend(payload, {
          datasets: state.datasets,
          time: state.time,
          lineStyleOptions: state.lineStyleOptions
        });

      // Otherwise, we are forking... add parent id.
      } else {
        payload.parent_id = this.options.target.id;
        resource = this.options.target.type + 's';
        verb = 'forked';

        if (this.options.target.type === 'dataset') {
          type = 'dataset';

          // Dataset has title, not name.
          payload.title = payload.name;
          delete payload.name;
        } else
          type = 'view';
      }

      // Start load indicator.
      this.saveButtonSpin.start();
      this.saveSubmit.addClass('loading');

      // Create the resource.
      rest.post('/api/' + resource, payload, _.bind(function (err, res) {

        // Start load indicator.
        this.saveButtonSpin.stop();
        this.saveSubmit.removeClass('loading').attr({disabled: 'disabled'});
        this.saveInput.val('');
        this.saveTags.val('');
        this.saveDescription.val('');

        if (err) {
          this.saveError.text(err);
          this.working = false;
          this.saveInput.addClass('input-error');
          this.focus();
          return;
        }
        
        // Show alert
        _.delay(_.bind(function () {
          mps.publish('flash/new', [{
            message: 'You ' + verb + ' a new ' + _.str.titleize(type) + ': "' + name + '"',
            level: 'alert'
          }]);
        }, this), 500);

        // Update URL.
        var route = resource === 'views' ?
            [res.author.username, 'views', res.slug].join('/'):
            [res.author.username, res.id].join('/');
        this.app.router.navigate('/' + route, {trigger: true, replace: false});

        // Close the modal.
        $.fancybox.close();

        // Ready for more.
        this.working = false;

      }, this));

      return false;
    },

    checkPrivate: function (e) {
      if (this.privateButton.hasClass('disabled')) return;
      var span = $('span', this.privateButton.parent());
      if (this.privateButton.is(':checked'))
        span.html('<i class="icon-lock"></i> Private');
      else
        span.html('<i class="icon-lock-open"></i> Public');
    },

  });
});
