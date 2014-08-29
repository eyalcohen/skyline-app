/*
 * Data finder modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'common', 
  'text!../../templates/finder.html',
  'views/lists/search.choices',
  'views/upload'
], function ($, _, Backbone, mps, rest, util, Spin, common, template,
      Choices, Upload) {
  return Backbone.View.extend({

    className: 'finder',
    dragging: false,
    working: false,
    files: null,

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      if (!this.options.searchQuery) {
        this.options.searchQuery = {};
      }
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
        margin: [-30,0,0,0],
        modal: true,
        closeClick: true
      });

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .modal-close': 'close',
      'click .stream-button': 'createStream',
      'change input[name="data_file"]': 'update'
    },

    setup: function () {

      // Save refs.
      this.newFileInput = this.$('input[name="dummy_data_file"]');
      this.newFile = this.$('input[name="data_file"]');
      this.newFileError = this.$('.file-error');
      this.dropZone = this.$('.dnd');

      this.newStreamUri = this.$('input[name="uri"]');
      this.newStreamSchedule = this.$('input[name="schedule"]');
      this.newStreamTransform = this.$('textarea[name="transform"]');
      this.newStreamError = this.$('.stream-error');
      this.newStreamButton = this.$('.stream-button');
      this.newStreamSpin = new Spin(this.$('.button-spin'), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Close modal.
      $(document).on('keyup', _.bind(function (e) {
        if (e.keyCode === 27 || e.which === 27) {
          this.close();
        }
      }, this));

      // Handle error display.
      this.$('input[type="text"], textarea').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Drag & drop events.
      this.$el.bind('dragover', _.bind(this.dragover, this));
      this.dropZone.bind('dragleave', _.bind(this.dragout, this))
          .bind('drop', _.bind(this.drop, this));

      // Init choices.
      if (this.options.search && this.app.profile && this.app.profile.user) {
        this.choices = new Choices(this.app, {
          reverse: true,
          el: '.finder-search',
          placeholder: 'Search for existing data...',
          route: true,
          choose: true,
          types: ['datasets', 'channels'],
          default: {
            type: 'datasets',
            query: {author_id: this.app.profile.user.id}
          }
        });
      }

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
      if (this.choices) {
        this.choices.destroy();
      }
      this.empty();
    },

    close: function (e) {
      this.working = false;
      $.fancybox.close();
    },

    dragover: function (e) {
      if (this.dragging) return false;
      this.dragging = true;
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.$el.addClass('dragging');
      return false;
    },

    dragout: function (e) {
      if ($(e.target).prop('tagName') === 'I') return false;
      this.dragging = false;
      this.$el.removeClass('dragging');
      return false;
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Stop drag styles.
      this.$el.removeClass('dragging');

      // Update the input field.
      this.update(null, e.originalEvent.dataTransfer.files);

      return false;
    },

    // Update new file input value
    update: function (e, files) {
      this.files = files || e.target.files;
      var name;
      this.newFileInput.val(name);
      if (this.files.length === 0) {
        name = '';
        this.newFileInput.val(name);
      } else {
        name = this.files[0].name;
        this.newFileInput.val(name);
        this.add();
      }
    },

    // Create new dataset from file.
    add: function (e) {
      if (e) e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Start load indicator.
      this.newFileButtonSpin.start();

      // Get the file.
      var files = this.files || this.newFile.get(0).files;

      if (files.length === 0) return false;
      var file = files[0];

      var cb = _.bind(function(err, res) {
        if (err) {
          this.newFileButtonSpin.stop();
          this.newFileError.text(err);
          this.working = false;
          $('.finder-progress-bar').width('0%');
        } else {
          this.fileId = res.fileId;
          this.app.router.navigate(['upload', this.fileId].join('/'), {trigger: true});
          this.close();
        }
      }, this);

      var cbProgress = _.bind(function(perc) {
        $('.finder-progress-bar').width(perc);
      }, this);
      var stopFcn = _.bind(function() {
        return !this.working;
      }, this);

      var reader = new FileReader();
      reader.onload = _.bind(function () {
        common.upload(file, reader, this.app, cb, cbProgress, stopFcn);
      }, this);

      reader.readAsDataURL(file);

      return false;
    },

    createStream: function (e) {
      if (e) e.preventDefault();
      var payload = {
        uri: this.newStreamUri.val().trim(),
        schedule: this.newStreamSchedule.val().trim(),
        transform: this.newStreamTransform.val().trim()
      };
      payload.author_id = this.app.profile.user.id;
      var check = util.ensure(payload, ['uri', 'schedule', 'transform']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('[name="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) {
          field.focus();
        }
      }, this));

      // Show messages.
      if (!check.valid) {
        this.newStreamError.text('All fields are required.');
        return false;
      }

      payload.schedule = Number(payload.schedule);
      if (isNaN(payload.schedule)) {
        this.newStreamError.text('Schedule must be a number.');
        return false;
      }

      this.newStreamSpin.start();
      this.newStreamButton.addClass('loading');

      rest.post('http://localhost:8081/create', payload,
          _.bind(function (err, data) {
        if (err) {
          this.newStreamSpin.stop();
          this.newStreamButton.removeClass('loading');
          this.newStreamError.text(err);
          return;
        }

        // Go to dataset page.
        this.app.router.navigate(data.path, {trigger: true});
        this.close();
      }, this));

      return false;
    }

  });
});
