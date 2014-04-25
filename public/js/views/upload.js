/*
 * Upload view for setting dataset attributes to be sent to the server.
 * Used after a file has been successfully uploaded to the server
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
  'text!../../templates/upload.html'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, template, upload_template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'upload',
    dragging: false,
    working: false,
    files: null,

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;

      // passed parameters
      this.uid = options.uid;
      this.channelNames = options.channelNames;
      this.fileName = options.fileName;
      this.timecolGuess = options.timecolGuess;
      this.cbUpload = options.cbUpload;

      // Client-wide subscriptions
      this.subscriptions = [];

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template, this.options);
      this.$el.html(this.template);

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
      'change input[name="data_file"]': 'update',
      'click .upload-private': 'checkPrivate',
      'click input[type="submit"]': 'submit',
      'change select[name="timecol"]': 'timeColChange'
    },

    // Misc. setup.
    setup: function () {

      this.uploadForm = $('.upload form');
      this.newFileDescription = $('textarea[name="description"]', this.uploadForm);

      this.newFileButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#fff',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Handle textarea.
      this.newFileDescription.bind('keyup', $.fancybox.reposition).autogrow();

      // Handle error display.
      this.$('input[type="text"]', this.uploadForm).blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Preload select inputs
      $('select[name="timecol"]', this.uploadForm).val(this.timecolGuess.column);

      var hint = 'Date';
      var hintList = _.map(this.timecolGuess.parseHints, function(f) {
        return f.toLowerCase();
      });
      if (_.contains(hintList, this.timecolGuess.dateHint)) {
        hint = this.timecolGuess.dateHint;
      }
      console.log(hint);
      $('select[name="timecolformat"]', this.uploadForm).val(hint);

      this.timeColChange();

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
      $.fancybox.close();
    },

    resize: function () {
    },

    // Update new file input value
    update: function (e, files) {
      this.files = files || e.target.files;
      var name;
      if (this.files.length === 0) {
        name = '';
        this.newFileSubmit.attr({disabled: 'disabled'});
      } else {
        name = this.files[0].name;
        this.newFileSubmit.attr({disabled: false});
      }
      this.newFileInput.val(name);
    },

    submit: function(e) {

      if (e) e.preventDefault();

      // Start load indicator.
      this.newFileButtonSpin.start();
      $('input[type="submit"]', this.uploadForm)
        .addClass('loading')
        .prop('disabled', 'disabled');

      // Construct the payload to send.
      var title = $('input[name="title"]', this.uploadForm).val();
      if (title === '') title = _.str.strLeft(this.fileName, '.');

      var channelPayload = {};
      _.each(this.channelNames, function(val, idx) {
        channelPayload[val] = {
          humanName: $('input[name="channelRename"]', this.uploadForm).eq(idx).val(),
          enabled: $('input[name="channelEnable"]', this.uploadForm).eq(idx).is(':checked')
        };
      });

      var payload = {
        title: util.sanitize(title),
        tags: util.sanitize($('input[name="tags"]', this.uploadForm).val()),
        description: util.sanitize($('textarea[name="description"]', this.uploadForm).val()),
        source: util.sanitize($('input[name="source"]', this.uploadForm).val()),
        sourceLink: util.sanitize($('input[name="source_link"]', this.uploadForm).val()),
        timecol:$('select[name="timecol"]', this.uploadForm).val(),
        timecolformat:$('select[name="timecolformat"]', this.uploadForm).val(),
        channels: channelPayload,
        public: !this.$('input[name="private"]', this.uploadForm).is(':checked'),
        uid: this.uid,
        fileName: this.fileName
      }

      this.app.rpc.do('insertSamples', payload, _.bind(function (err, res) {

        this.newFileButtonSpin.stop();

        if (err) {
          $('input[type="submit"]', this.uploadForm)
            .removeClass('loading')
            .prop('disabled', false);
          $('.modal-error').text(err);
        }
        else {

          // Show alert
          _.delay(function() {
            mps.publish('flash/new', [{
              message: 'You added a new dataset: "'
                  + res.title + ', ' + res.meta.channel_cnt + ' channel'
                  + (res.meta.channel_cnt !== 1 ? 's':'') + '"',
              level: 'alert'
            }]);
          }, 500);
          if (this.cbUpload) {
            this.cbUpload(res);
          }
          this.close();
        }

      }, this));
    },

    checkPrivate: function (e) {
      var privacy = $('input[name="private"]', this.uploadForm);
      var span = $('span', privacy.parent());
      if (privacy.is(':checked'))
        span.html('<i class="icon-lock"></i> Private');
      else
        span.html('<i class="icon-lock-open"></i> Public');
    },

    timeColChange: function(e) {
      var timecol = $('select[name="timecol"]', this.uploadForm).val();
      var idx = $.inArray(timecol, this.channelNames);
      var channelInputs = $('.upload-channel-rows', this.uploadForm);
      channelInputs.eq(idx).hide(e ? 250 : 0);
      channelInputs.each(function(index, c) {
        if (index !== idx) $(c).show(250);
      });
    }

  });
});
