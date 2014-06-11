/*
 * Upload interface
 *
 * TODO:
 * - Enable time column behavior
 * - Tab ordering
 * - Table style
 * - Email on failure
 * - Add transpose function
 * - Seperate upload page
 * - General styling
 * - Title for page
 * - Failure if page was loaded unexpectedly
 * - Validate header rows is a number
 * - File information in right side
 * - Red font the error
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
      console.log(this.options);

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
      'change .upload-form select': 'preview',
      'click .upload-form .button': 'submit'
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
        console.log(err, res);
        this.template = _.template(template);
        this.$el.html(this.template.call(this, {util: util}));

        this.uploadForm = $('.upload-form');

        this.timeFormatSelect = this.uploadForm.find('select[name*="uploadTimeFormat"]');
        this.dateFormatSelect = this.uploadForm.find('select[name*="uploadDateFormat"]');

        this.app.rpc.do('getDateTimeFormats', _.bind(function (err, res) {
          this.dateFormats = res.df;
          this.timeFormats = res.tf;
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
        $('.upload-table-wrap').hide();
        return;
      }

      $('.upload-table-wrap').show('fast');

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
      var keys = [res.dateColumn].concat(_keys);

      // header row
      var str = ''
      _.each(_.drop(keys, 1), function (k) {
        str += '<th>' + k + '</th>';
      });
      var sel = table.append($('<tr>')
        .append($('<th>').text('Skyline date/time').after('</th>' + str)));
      table.find('tr').after('</tr>');

      // first rows
      _.each(res.firstRows, function(r) {
        str = '<tr>'
        _.each(keys, function (k) {
          str += '<td>' + r[k] + '</td>';
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
          str += '<td>' + r[k] + '</td>';
        });
        str += '</tr>'
        table.append(str);
      });

    },

    submit: function(e) {
      console.log('submit');
      this.app.rpc.do('insertSamples', { fileId: this.fileId }, _.bind(function (err, res) {
        if (err) {
          $('.upload-preview-error').text(err);
          $('.upload-table-wrap').hide();
        } else {
          var path = [this.app.profile.user.username, res.id, 'config'].join('/');
          this.app.router.navigate(path, {trigger: true});
        }
        console.log(err, res);
      }, this));
    }

  });
});
