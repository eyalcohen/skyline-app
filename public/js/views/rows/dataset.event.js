/*
 * Dataset event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'common',
  'mps',
  'rest',
  'util',
  'models/dataset',
  'text!../../../templates/rows/dataset.event.html',
  'text!../../../templates/dataset.header.html',
  'views/lists/comments',
  'views/lists/notes',
  'text!../../../templates/confirm.html'
], function ($, _, Backbone, common, mps, rest, util, Model, template,
             header, Comments, Notes, confirm) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-dataset'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.config = options.config;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      // Socket subscriptions.
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'change .dataset-param': 'save',
      'click .demolish': 'demolish',
      'click .event-channel-delete': 'deleteChannel',
      'change .event-channel-input': 'saveChannel',
      'change .event-unit-input': 'saveChannel',
      'click .save-private': 'checkPrivate'
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this, {util: util}));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
      }

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Skyline | ' + this.model.get('title'));

        // Render title.
        this.title = _.template(header).call(this, {util: util});
      }

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Save field contents on blur.
      if (this.config) {
        this.privateButton = this.$('.save-private');

        // Show greeting.
        this.$('.config-greeting').show();
      }

      // Render lists.
      if (!this.config) {
        this.comments = new Comments(this.app,
            {parentView: this, type: 'dataset'});
        if (!this.parentView) {
          this.notes = new Notes(this.app,
              {parentView: this, sort: 'created', reverse: true});
        }
      }

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        // This is a hack to allow parent pages to render before drawing SVGs
        _.delay(_.bind(common.drawChannel, this, c), 50);
      }, this));

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // For rendering tooltips
      if (this.parentView) {
        this.parentView.$('.tooltip').tooltipster({delay: 600, multiple: true});
      }
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.comments) {
        this.comments.destroy();
      }
      if (this.notes) {
        this.notes.destroy();
      }
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      e.stopPropagation();
      if ($(e.target).hasClass('event-channel-delete')
          || $(e.target).hasClass('event-channel-input')
          || $(e.target).hasClass('event-unit-input')
          || $(e.target).hasClass('icon-cancel')) {
        return;
      }
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    // Save the field.
    save: function (e) {
      var field = $(e.target);
      var name = field.attr('name');
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Now do the save.
      rest.put('/api/datasets/' + this.model.id, payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

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
        message: 'Delete this dataset?',
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
        rest.delete('/api/datasets/' + this.model.id,
            {}, _.bind(function (err) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error'}]);
            return false;
          }

          // Route to home.
          if (!this.parentView) {
            this.app.router.navigate('/', {trigger: true});
          }

          // Close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

    deleteChannel: function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this channel?',
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
      $('.modal-confirm').click(_.bind(function () {

        // Delete the doc.
        var li = $(e.target).closest('li');
        rest.delete('/api/channels/' + li.data('id'),
            {}, _.bind(function (err, data) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error'}]);
            return false;
          }
          li.remove();

          // Close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

    removeChannel: function (data) {
      var li = $('li[data-id=' + data.id + ']').remove();
    },

    saveChannel: function (e) {
      var field = $(e.target);
      var name = field.data('param');
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Now do the save.
      rest.put('/api/channels/' + field.attr('id'), payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

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

    checkPrivate: function (e) {
      if (this.privateButton.hasClass('disabled')) return;
      var span = $('span', this.privateButton.parent());
      var payload = {};
      if (this.privateButton.is(':checked')) {
        span.html('<i class="icon-lock"></i> Private');
        payload.public = false;
      } else {
        span.html('<i class="icon-lock-open"></i> Public');
        payload.public = true;
      }

      // Now do the save.
      rest.put('/api/datasets/' + this.model.id, payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);
      }, this));
    },

    when: function () {
      if (!this.model.get('created')) {
        return;
      }
      if (!this.time) {
        this.time = this.$('time.created:first');
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
