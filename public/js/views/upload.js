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

      this.on('rendered', this.setup, this);

    },

    render: function () {

      // Set page title
      this.app.title('Skyline');
      this.trigger('rendered');
      return this;
    },

    events: {
      'change input[name="data_file"]': 'update',
      'change .upload-form input': 'preview',
      'change .upload-form select': 'preview'
    },

    setup: function () {

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

      this.uploadForm = $('.upload-form');

      this.timeFormatSelect = this.uploadForm.find('select[name*="uploadTimeFormat"]');
      this.dateFormatSelect = this.uploadForm.find('select[name*="uploadDateFormat"]');

      this.app.rpc.do('getDateTimeFormats', _.bind(function (err, res) {
        this.dateFormats = res.df;
        this.timeFormats = res.tf;
        _.each(this.dateFormats, _.bind(function(val, key) {
          this.dateFormatSelect.append('<option value="' + key + '">' + key + ' - ' + val.example + '</option>');
        }, this));
        _.each(this.timeFormats, _.bind(function(val, key) {
          this.timeFormatSelect.append('<option value="' + key + '">' + key + ' - ' + val.example + '</option>');
        }, this));
      }, this));

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

      var cb = _.bind(function(err, res) {
        if (err) {
          this.newFileButtonSpin.stop();
          this.newFileError.text(err);
          this.working = false;
          $('.finder-progress-bar').width('0%');
        } else {
          this.fileId = res.fileId;
          this.updateView(null, res);
        }

        //this.updateView(res);
      }, this);
      var cbProgress = _.bind(function(perc) {
        $('.finder-progress-bar').width(perc);
      }, this);
      var stopFcn = _.bind(function() {
        return !this.working;
      }, this);

      var reader = new FileReader();
      reader.onload = _.bind(function () {
        common.upload(file, reader, this.app, cb, cbProgress,
                      null, stopFcn);
      }, this);

      reader.readAsDataURL(file);

      return false;
    },

    preview: function(e) {

      var headers = this.uploadForm.find('input[name*="uploadHeaderRows"]').val();
      var dateCol = this.uploadForm.find('select[name*="uploadDateColumn"]').val();
      var dateFormat = this.uploadForm.find('select[name*="uploadDateFormat"]').val();
      var timeSel = this.uploadForm.find('input[name*="uploadTimeSelect"]:checked').val();
      var timeCol, timeFormat;

      if (timeSel === 'none') {
        $('.upload-time-options input, .upload-time-options select').prop('disabled', true);
      }
      else if (timeSel === 'both') {
        $('.upload-time-options input, .upload-time-options select').prop('disabled', true);
        timeFormat =  this.uploadForm.find('select[name*="uploadTimeFormat"]').val();
      }
      else if (timeSel === 'sep') {
        $('.upload-time-options input, .upload-time-options select').prop('disabled', true);
        timeColumn =  this.uploadForm.find('select[name*="uploadTimeColumn"]').val();
        timeFormat =  this.uploadForm.find('select[name*="uploadTimeFormat"]').val();
      }

      var payload = {
        fileId:  this.fileId,
        skipHeaderRows: headers,
        dateColumn: dateCol,
        dateFormat: dateFormat,
        timeCol: timeCol,
        timeFormat: timeFormat
      };

      this.app.rpc.do('previewFileInsertion', payload, _.bind(this.updateView, this));
    },

    updateView: function(err, res) {
      console.log('preview result', res);

      var table = $('.upload-preview-table tbody');
      table.empty();

      if (err) {
        $('.upload-preview-error').text(err);
        return;
      }

      /* Add headers */
      var dateCol = this.uploadForm.find('select[name*=uploadDateColumn]');
      var timeCol = this.uploadForm.find('select[name*=uploadTimeColumn]');
      timeCol.empty();  dateCol.empty();
      _.each(res.headers, function(h) {
        timeCol.append('<option>' + h + '</option>');
        dateCol.append('<option>' + h + '</option>');
      });
      dateCol.removeAttr('selected').find('option:first')
        .attr('selected', res.headers.indexOf(res.dateColumn));

      // Update date format if it was supplied
      if (res.dateFormat) {
        this.uploadForm.find('select[name*=uploadDateFormat]').val(res.dateFormat);
      }

      // Display data/time and 2 other columns
      var _keys = _.reject(res.headers, function(f) {
        return f === res.dateColumn;
      });
      var keys = [res.dateColumn].concat(_.first(_keys, 2));

      // header row
      table.append($('<tr>')
        .append($('<th>').text('Skyline date/time').after('</th>')

        .after($('<th>').text(keys[1]).after('</th>')
        .after($('<th>').text(keys[2]).after('</th>')))));
      table.find('tr').after('</tr>');

      // first rows
      _.each(res.firstRows, function(r) {
        table.append($('<tr>')
          .append($('<td>').text(r[keys[0]]).after('</td>')

          .after($('<td>').text(r[keys[1]]).after('</td>')
          .after($('<td>').text(r[keys[2]]).after('</td>')))));
        table.find('tr').after('</tr>');
      });

      // Add a seperator to table, so user knows there's a gap in time
      table.append('<tr><td></td><td></td><td></td></tr>');

      // Add last rows to table
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
