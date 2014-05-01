/*
 * Data browser modal view
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
  'views/lists/datasets.finder',
  'views/upload'
], function ($, _, Backbone, mps, rest, util, Spin, common, template,
      Datasets, Upload) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'browser',
    dragging: false,
    working: false,
    files: null,

    // Module entry point.
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

      // Add library class
      if (this.options.lib && this.app.profile && this.app.profile.user)
        this.$el.addClass('library');

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
      'change input[name="data_file"]': 'update',
      'click .browser-search-justme': 'checkJustMe',
      'click .browser-search-allusers': 'checkAllUsers'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.justme = this.$('.browser-search-justme');
      this.allusers = this.$('.browser-search-allusers');
      this.addNewFileForm = $('.browser-add-form');
      this.newFileInput = $('input[name="dummy_data_file"]', this.addNewFileForm);
      this.newFile = $('input[name="data_file"]', this.addNewFileForm);
      this.newFileError = $('.modal-error', this.addNewFileForm);
      this.dropZone = $('.browser .dnd');
      this.newFileButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#fff',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });
      this.searchInput = this.$('input[name="search"]');

      // Handle search input.
      this.searchInput.bind('keyup', _.bind(this.search, this));
      this.searchInput.bind('search', _.bind(this.search, this));

      // Drag & drop events.
      this.$el.bind('dragover', _.bind(this.dragover, this));
      this.dropZone.bind('dragleave', _.bind(this.dragout, this))
          .bind('drop', _.bind(this.drop, this));

      // Handle error display.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Render datasets.
      if (this.options.lib && this.app.profile && this.app.profile.user)
        this.datasets = new Datasets(this.app, {
          datasets: {
            more: true,
            items: [],
            query: {author_id: this.app.profile.user.id}
          },
          searchQuery: {author_id: this.app.profile.user.id},
          modal: true,
          parentView: this,
          reverse: true
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
      if (this.datasets)
        this.datasets.destroy();
      this.empty();
    },

    close: function (e) {
      this.working = false;
      $.fancybox.close();
    },

    resize: function () {
      if (!this.datasets) return;
      var wrap = $('.profile-items-wrap', this.datasets.$el);
      wrap.height(this.$el.height() - wrap.position().top);
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
        $('.browser-progress-bar').width('0%');
      }, this);
      var cbSuccess = _.bind(function() {
      }, this);
      var cbProgress = _.bind(function(perc) {
        $('.browser-progress-bar').width(perc);
      }, this);
      var stopFcn = _.bind(function() {
        return !this.working;
      }, this);

      var reader = new FileReader();
      reader.onload = _.bind(function () {
        common.upload(file, reader, this.app, cbSuccess, cbFail, cbProgress,
                      null, stopFcn);
      }, this);

      reader.readAsDataURL(file);

      return false;
    },

    checkJustMe: function (e) {
      this.justme.attr('checked', true);
      this.allusers.attr('checked', false);
      this.datasets.options.searchQuery.author_id = this.app.profile.user.id;
      if (this.datasets.searching)
        this.search();
    },

    checkAllUsers: function (e) {
      this.justme.attr('checked', false);
      this.allusers.attr('checked', true);
      delete this.datasets.options.searchQuery.author_id;
      if (this.datasets.searching)
        this.search();
    },

    search: function (e) {
      this.datasets.search(util.sanitize(this.searchInput.val()));
    },

  });
});
