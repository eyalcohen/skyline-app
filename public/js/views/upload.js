/*
 * Upload interface
 *
 * TODO:
 * - Row numbers on preview table
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
  'views/error',
  'text!../../templates/upload.html',
  'text!../../templates/upload.header.html'
], function ($, _, Backbone, mps, rest, util, Spin, common, Error, template, header) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.fileId = options.fileId;
      this.subscriptions = [
        mps.subscribe('upload/finish', _.bind(this.submit, this)),
        mps.subscribe('upload/cancel', _.bind(function () {
          // Backbone.history.history.back();
          this.app.router.navigate('/', {trigger: true});
        }, this)),
      ];
      this.on('rendered', this.setup, this);

      // Add a big spinner to parent el.
      var overlay = $('<div class="upload-spin">').appendTo(this.$el.parent());
      var spin = new Spin($('<div>').appendTo(overlay), {color: '#8f8f8f',
          lines: 17, length: 7, width: 2, radius: 12});
      this.spin = {
        start: _.bind(function () {
          overlay.show();
          this.clearError();
          spin.start();
        }, this),
        stop: function () {
          overlay.fadeOut('slow');
          spin.stop();
        }
      };
      this.spin.start();
    },

    render: function () {
      this.template = _.template(template);

      // Set page title
      this.app.title('Skyline - Upload file');
      this.title = _.template(header).call(this, {util: util});

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .button:not(disabled)': 'submit',
    },

    setup: function () {

      // Do initial preview.
      this.app.rpc.do('previewFileInsertion', {fileId: this.fileId},
          _.bind(function (err, res) {
        if (this.handleFileError(err)) {
          return;
        }
        this.$el.append(this.template.call(this));

        // Save refs.
        this.skipHeaderRows = this.$('input[name*="upload-header-rows"]');
        this.transpose = this.$('input[name*="upload-transpose"]');
        this.reverse = this.$('input[name*="upload-reverse"]');
        this.timeFormatSelect = this.$('select[name*="upload-time-format"]');
        this.dateFormatSelect = this.$('select[name*="upload-date-format"]');
        this.dateColumnSelect = this.$('select[name*=upload-date-column]');
        this.timeColumnSelect = this.$('select[name*=upload-time-column]');
        this.timeOptions = this.$('.upload-time-options');
        this.table = this.$('.upload-preview');
        this.errorDisplay = this.$('.upload-error');
        this.setDateTimeFormats();
        
        // Debounce change inputs.
        this.$('input, select').change(_.debounce(_.bind(this.preview, this), 200));

        this.updateView(err, res);
      }, this));
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
      if (this.error) {
        this.error.destroy();
      }
      this.empty();
    },

    // Populate 'select' inputs with date and time formats.
    setDateTimeFormats: function () {
      _.each(this.app.profile.content.df, _.bind(function (val, key) {
        if (val.example) {
          this.dateFormatSelect.append('<option value="' + key
            + '">' + key + '&nbsp&nbsp eg, ' + val.example + '</option>');
        } else {
          this.dateFormatSelect.append('<option value="' + key
            + '">' + key + '</option>');
        }
      }, this));
      _.each(this.app.profile.content.tf, _.bind(function (val, key) {
        this.timeFormatSelect.append('<option value="' + key
          + '">' + key + '&nbsp&nbsp eg, ' + val.example + '</option>');
      }, this));
    },

    // Make a server request that lets us knmow if this dataset will work.
    preview: function(e) {
      mps.publish('upload/disable');
      this.spin.start();

      var tc, tf;
      switch (this.$('input[name*="upload-time-select"]:checked').val()) {
        case 'none':
          this.timeOptions.hide();
          this.timeColumnSelect.addClass('disabled').prop('disabled', true);
          this.timeFormatSelect.addClass('disabled').prop('disabled', true);
          break;
        case 'both':
          this.timeOptions.show();
          this.timeColumnSelect.addClass('disabled').prop('disabled', true);
          tf = this.timeFormatSelect.removeClass('disabled').prop('disabled', false).val();
          break;
        case 'sep':
          this.timeOptions.show();
          tc = this.timeColumnSelect.removeClass('disabled').prop('disabled', false).val();
          tf = this.timeFormatSelect.removeClass('disabled').prop('disabled', false).val();
          break;
      }

      // Do preview.
      var payload = {
        fileId: this.fileId,
        transpose: this.transpose.is(':checked'),
        reverse: this.reverse.is(':checked'),
        skipHeaderRows: this.skipHeaderRows.val(),
        dateColumn: this.dateColumnSelect.val(),
        dateFormat: this.dateFormatSelect.val(),
        timeColumn: tc,
        timeFormat: tf
      };
      this.app.rpc.do('previewFileInsertion', payload, _.bind(this.updateView, this));
    },

    updateView: function(err, res) {
      if (this.handleFileError(err)) {
        return;
      }
      this.table.empty();

      // Update drop-downs information
      if (res && res.headers) {
        this.timeColumnSelect.empty();
        this.dateColumnSelect.empty();
        _.each(res.headers, _.bind(function (h) {
          this.timeColumnSelect.append('<option>' + h + '</option>');
          this.dateColumnSelect.append('<option>' + h + '</option>');
        }, this));
        if (res.dateColumn) {
          this.dateColumnSelect.val(res.dateColumn);
        }
        if (res.timeColumn) {
          this.timeColumnSelect.val(res.timeColumn);
        }
        if (res.dateFormat) {
          this.dateFormatSelect.val(res.dateFormat);
        }
        if (res.timeFormat) {
          this.timeFormatSelect.val(res.timeFormat);
        }
      }

      // Get headers, but re-order them so date/time is first
      var keys = [];
      if (res && res.firstRows && res.dateColumn) {
        var _keys = _.reject(_.keys(res.firstRows[0]), function (f) {
          return f === res.dateColumn;
        });
        keys = [res.dateColumn].concat(_keys);
      }

      if (err) {

        // Show error.
        this.setError(err);
        this.spin.stop();

        // Show problem rows.
        if (res && res.problemRow) {

          // header row
          var str = ''
          var keys = _.keys(res.problemRow[0]);
          _.each(keys, function (k) {
            str += '<th>' + util.blurb(k, 24) + '</th>';
          });
          var sel = this.table.append('<tr>' + str + '</tr>')

          // Display the row that caused the error, and style it some.
          _.each(res.problemRow, _.bind(function (pr, idx) {
            str = '<tr>'
            _.each(keys, function (k) {
              str += '<td>' + (pr[k] ? pr[k] : '') + '</td>';
            });
            str += '</tr>'
            var el = $(str);
            this.table.append(el);
            if (idx === res.problemRow.length-1) {
              el.addClass('problem-row');
            }
          }, this));
        }
        return;
      }

      // Header row
      var str = ''
      _.each(keys, function (k) {
        str += '<th>' + util.blurb(k, 24) + '</th>';
      });
      var sel = this.table.append('<tr>' + str + '</tr>')

      // First Rows
      _.each(res.firstRows, _.bind(function (r) {
        str = '<tr>'
        _.each(keys, function (k) {
          str += '<td>' + (r[k] ? r[k] : '') + '</td>';
        });
        str += '</tr>'
        this.table.append(str);
      }, this));

      // Add a seperator to table, so user knows there's a gap in time
      this.table.append('<tr><td>...</td></tr>');

      // Add last rows to table
      _.each(res.lastRows, _.bind(function (r) {
        str = '<tr>'
        _.each(keys, function (k) {
          str += '<td>' + (r[k] ? r[k] : '') + '</td>';
        });
        str += '</tr>'
        this.table.append(str);
      }, this));

      mps.publish('upload/enable');
      this.spin.stop();
    },

    handleFileError: function (err) {
      if (err && _.isObject(err) && err.code === 404) {
        this.error = new Error(this.app).render(err);
        this.spin.stop();
        return true;
      } else {
        return false;
      }
    },

    setError: function (str) {
      var i = '<i class="icon-error-alt"></i>';
      this.errorDisplay.html([i, str, i].join(' ')).show();
    },

    clearError: function () {
      if (this.errorDisplay) {
        this.errorDisplay.hide();
      }
    },

    // If user is happy with the preview, insert samples into the database.
    submit: function() {
      this.spin.start();

      this.app.rpc.do('insertSamples', {fileId: this.fileId}, _.bind(function (err, res) {
        this.spin.stop();
        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return;
        }

        // On success, we navigate to the dataset landing page.
        var path = [this.app.profile.user.username, res.id, 'config'].join('/');
        this.app.router.navigate(path, {trigger: true});
      }, this));
    }

  });
});
