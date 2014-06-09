/*
 * Upload interface
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
  'text!../../templates/upload.html',
], function ($, _, Backbone, mps, rest, util, Spin, common, template) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      console.log('rendered', common);

      this.on('rendered', this.setup, this);

    },

    render: function () {

      // Set page title
      this.app.title('Skyline');
      this.trigger('rendered');
      return this;
    },

    events: {
      'change input[name="data_file"]': 'update'
    },

    setup: function () {
      console.log('setup');

      this.template = _.template(template);
      this.$el.html(this.template.call(this, {util: util}));

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

      // Drag & drop events.
      this.$el.bind('dragover', _.bind(this.dragover, this));
      this.dropZone.bind('dragleave', _.bind(this.dragout, this))
          .bind('drop', _.bind(this.drop, this));

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
      var cbSuccess = _.bind(function(res) {
        console.log(res);
        this.preview(res);
      }, this);
      var cbProgress = _.bind(function(perc) {
        $('.finder-progress-bar').width(perc);
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

    preview: function(res) {
      var table = $('.upload-preview-table tbody');

      // take three keys to display in the table, but make sure date is one of them
      delete res.header[res.dateColumn];
      var keys = [res.dateColumn].concat(_.first(_.keys(res.header), 2));

      // header row
      table.append($('<tr>')
        .append($('<td>').text(keys[0]).after('</td>')

        .after($('<td>').text(keys[1]).after('</td>')
        .after($('<td>').text(keys[2]).after('</td>')))));
      table.find('tr').after('</tr>');

      _.each(res.firstRows, function(r) {
        table.append($('<tr>')
          .append($('<td>').text(r[keys[0]]).after('</td>')

          .after($('<td>').text(r[keys[1]]).after('</td>')
          .after($('<td>').text(r[keys[2]]).after('</td>')))));
        table.find('tr').after('</tr>');
      });

      // Add a seperator to table, so user knows there's a gap in time
      table.append('<tr><td colspan="3"></td></tr>');

      // Add resultant last rows to table
      _.each(res.lastRows, function(r) {
        table.append($('<tr>')
          .append($('<td>').text(r[keys[0]]).after('</td>')

          .after($('<td>').text(r[keys[1]]).after('</td>')
          .after($('<td>').text(r[keys[2]]).after('</td>')))));
        table.find('tr').after('</tr>');
      });

    },

  });
});
