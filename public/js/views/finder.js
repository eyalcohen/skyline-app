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

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .modal-close': 'close',
      'change input[name="data_file"]': 'update'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.newFileInput = this.$('input[name="dummy_data_file"]');
      this.newFile = this.$('input[name="data_file"]');
      this.newFileError = this.$('.modal-error');
      this.dropZone = this.$('.dnd');
      this.newFileButtonSpin = new Spin(this.$('.button-spin'), {
        color: '#fff',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6
      });

      // Close modal.
      $(document).on('keyup', _.bind(function (e) {
        if (e.keyCode === 27 || e.which === 27) {
          this.close();
        }
      }, this));

      // Drag & drop events.
      this.$el.bind('dragover', _.bind(this.dragover, this));
      this.dropZone.bind('dragleave', _.bind(this.dragout, this))
          .bind('drop', _.bind(this.drop, this));

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

      // Use a FileReader to read the file as a base64 string.
      var cbFail = _.bind(function(err) {
        this.newFileButtonSpin.stop();
        this.newFileError.text(err);
        this.working = false;
        $('.finder-progress-bar').width('0%');
      }, this);
      //var cbSuccess = _.bind(function(res) {
      //  console.log('success', res);
      //}, this);
      var cbProgress = _.bind(function(perc) {
        $('.finder-progress-bar').width(perc);
      }, this);
      var stopFcn = _.bind(function() {
        return !this.working;
      }, this);

      var reader = new FileReader();
      reader.onload = _.bind(function () {
        common.upload(file, reader, this.app, null, cbFail, cbProgress,
                      stopFcn);
      }, this);

      reader.readAsDataURL(file);

      return false;
    },

  });
});
