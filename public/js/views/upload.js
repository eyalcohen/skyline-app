/*
 * Upload interface
 *
 * TODO:
 * - Row numbers on preview table
 * - add 'working' guard so can't submit while server is processing
 * - Add spinner on first page load
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
      this.fileId = options.fileId;
      this.on('rendered', this.setup, this);
    },

    render: function () {

      // Set page title
      this.app.title('Skyline - Upload file');
      this.trigger('rendered');
      return this;
    },

    events: {
      'change .upload-form input': 'preview',
      'change .upload-form select': 'preview',
      'click .button:not(disabled)': 'submit',
    },

    setup: function () {

      if (!this.fileId) {
        mps.publish('modal/finder/open');
        return;
      }

      var payload = {
        fileId:  this.fileId,
      };

      this.app.rpc.do('previewFileInsertion', payload, _.bind(function(err, res) {
        this.template = _.template(template);
        this.$el.empty();
        this.$el.append(this.template.call(this, {util: util}));

        this.uploadForm = $('.upload-form');

        this.timeFormatSelect = this.uploadForm.find('select[name*="upload-time-format"]');
        this.dateFormatSelect = this.uploadForm.find('select[name*="upload-date-format"]');

        this.app.rpc.do('getDateTimeFormats', _.bind(function (err, res) {
          this.dateFormats = res.df;
          this.timeFormats = res.tf;

          // Populate 'select' inputs with date and time formats
          _.each(this.dateFormats, _.bind(function(val, key) {
            if (val.example) {
              this.dateFormatSelect.append('<option value="' + key
                + '">' + key + '&nbsp&nbsp eg, ' + val.example + '</option>');
            } else {
              this.dateFormatSelect.append('<option value="' + key
                + '">' + key + '</option>');
            }
          }, this));
          _.each(this.timeFormats, _.bind(function(val, key) {
            this.timeFormatSelect.append('<option value="' + key
              + '">' + key + '&nbsp&nbsp eg, ' + val.example + '</option>');
          }, this));
        }, this));

        this.newFileButtonSpin = new Spin(this.$('.button-spin'), {
          color: '#fff',
          lines: 13,
          length: 3,
          width: 2,
          radius: 6
        });

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
      this.empty();
    },

    // Make a server request that lets us knmow if this dataset will work.
    preview: function(e) {

      this.spin = new Spin(this.$('.upload-preview-spin'), {
          color: '#3d3d3d',
          lines: 13,
          length: 3,
          width: 2,
          radius: 6
      });

      this.spin.start();

      var skipHeaders = this.uploadForm.find('input[name*="upload-header-rows"]').val();
      var dateCol = this.uploadForm.find('select[name*="upload-date-column"]').val();
      var dateFormat = this.uploadForm.find('select[name*="upload-date-format"]').val();
      var timeSel = this.uploadForm.find('input[name*="upload-time-select"]:checked').val();
      var transpose = this.uploadForm.find('input[name*="upload-transpose"]').is(':checked');
      var reverse = this.uploadForm.find('input[name*="upload-reverse"]').is(':checked');
      var timeColumn, timeFormat;

      if (timeSel === 'none') {
        $('.upload-time-options').hide('fast');
        $('.upload-time-options select').prop('disabled', true).addClass('disabled');
      }
      else if (timeSel === 'both') {
        $('.upload-time-options').show('fast');
        this.uploadForm.find('select[name*="upload-time-column"]')
          .prop('disabled', true)
          .addClass('disabled')
        timeFormat =  this.uploadForm.find('select[name*="upload-time-format"]')
          .prop('disabled', false)
          .removeClass('disabled')
          .val();
      }
      else if (timeSel === 'sep') {
        $('.upload-time-options').show('fast');
        $('.upload-time-options select')
          .prop('disabled', false)
          .removeClass('disabled')
        timeColumn =  this.uploadForm.find('select[name*="upload-time-column"]').val();
        timeFormat =  this.uploadForm.find('select[name*="upload-time-format"]').val();
      }

      var payload = {
        fileId:  this.fileId,
        transpose: transpose,
        reverse: reverse,
        skipHeaderRows: skipHeaders,
        dateColumn: dateCol,
        dateFormat: dateFormat,
        timeColumn: timeColumn,
        timeFormat: timeFormat
      };

      this.app.rpc.do('previewFileInsertion', payload, _.bind(this.updateView, this));
    },

    updateView: function(err, res) {

      if (this.spin) this.spin.stop();

      var table = $('.upload-preview-table tbody');
      table.empty();

      var rePreview = false;

      // Update drop-downs information
      if (res && res.headers) {
        var dateCol = this.uploadForm.find('select[name*=upload-date-column]');
        var timeCol = this.uploadForm.find('select[name*=upload-time-column]');
        timeCol.empty();  dateCol.empty();
        _.each(res.headers, function(h) {
          timeCol.append('<option>' + h + '</option>');
          dateCol.append('<option>' + h + '</option>');
        });
        if (res.dateColumn) {
          dateCol.val(res.dateColumn);
        }
        if (res.timeColumn) {
          timeCol.val(res.timeColumn);
        }
        if (res.dateFormat) {
          this.uploadForm.find('select[name*=upload-date-format]').val(res.dateFormat);
        }
        if (res.timeFormat) {
          this.uploadForm.find('select[name*=upload-time-format]').val(res.timeFormat);
        }
      }

      // Get headers, but re-order them so date/time is first
      var keys = [];
      if (res && res.firstRows && res.dateColumn) {
        var _keys = _.reject(_.keys(res.firstRows[0]), function(f) {
          return f === res.dateColumn;
        });
        keys = [res.dateColumn].concat(_keys);
      }

      // Otherwise display errors
      if (err) {
        $('.upload-preview-error').text(err).fadeIn();
        //$('.upload-table-wrap-outter').hide();
        $('.upload-form .button').addClass('disabled').prop('disabled', true);

        if (res && res.problemRow) {

          // header row
          var str = ''
          _.each(_.keys(res.problemRow[0]), function (k) {
            str += '<th>' + util.blurb(k, 24) + '</th>';
          });
          var sel = table.append('<tr>' + str + '</tr>')

          // Display the row that caused the error, and style it some.
          _.each(res.problemRow, function (pr, idx) {
            str = '<tr>'
            _.each(keys, function (k) {
              str += '<td>' + (pr[k] ? pr[k] : '') + '</td>';
            });
            str += '</tr>'
            var el = $(str);
            table.append(el);
            if (idx === res.problemRow.length-1) {
              el.addClass('problem-row');
            }
          });
          $('.upload-table-wrap-outter').show('fast');
        }
        return;
      }

      // If we don't have errors, we show a preview table

      $('.upload-table-wrap-outter').show('fast');
      $('.upload-form .button').removeClass('disabled').prop('disabled', false);
      $('.upload-preview-error').hide();

      // Build preview table

      // Header row
      var str = ''
      _.each(keys, function (k) {
        str += '<th>' + util.blurb(k, 24) + '</th>';
      });
      var sel = table.append('<tr>' + str + '</tr>')

      // First Rows
      _.each(res.firstRows, function(r) {
        str = '<tr>'
        _.each(keys, function (k) {
          str += '<td>' + (r[k] ? r[k] : '') + '</td>';
        });
        str += '</tr>'
        table.append(str);
      });

      // Add a seperator to table, so user knows there's a gap in time
      table.append('<tr><td>...</td></tr>');

      // Add last rows to table
      _.each(res.lastRows, function(r) {
        str = '<tr>'
        _.each(keys, function (k) {
          str += '<td>' + (r[k] ? r[k] : '') + '</td>';
        });
        str += '</tr>'
        table.append(str);
      });

    },

    // If user is happy with the preview, insert samples into the database.
    submit: function(e) {
      // Start load indicator.
      this.newFileButtonSpin.start();

      this.app.rpc.do('insertSamples', { fileId: this.fileId }, _.bind(function (err, res) {
        this.newFileButtonSpin.stop();
        if (err) {
          $('.upload-preview-error').text(err);
        } else {
          // On success, we navigatew to the dataset landing page
          var path = [this.app.profile.user.username, res.id, 'config'].join('/');
          this.app.router.navigate(path, {trigger: true});
        }
      }, this));
    }

  });
});
