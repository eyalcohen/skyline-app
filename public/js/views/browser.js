/*
 * Data browser modal view
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
  'text!../../templates/browser.html',
  'views/lists/profile.datasets'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, template, Datasets) {

  return Backbone.View.extend({
    
    // The DOM target element for this page.
    className: 'browser',
    working: false,
    
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

      // Add library class if
      if (this.options.lib)
        this.$el.addClass('library');

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
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
      'click .browser-add-form input[type="submit"]': 'add',
      'change input[name="data_file"]': 'update',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.addNewfileForm = $('.browser-add-form');
      this.newFileInput = $('input[name="dummy_data_file"]', this.addNewfileForm);
      this.newFile = $('input[name="data_file"]', this.addNewfileForm);
      this.newFileSubmit = $('input[type="submit"]', this.addNewfileForm);
      this.newFileError = $('.modal-error', this.addNewfileForm);
      this.dropZone = this.$('.dnd');
      this.newFileButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Drag & drop events.
      this.$el.on('dragover', _.bind(this.dragover, this));
      this.dropZone.on('dragleave', _.bind(this.dragout, this))
          .on('drop', _.bind(this.drop, this));

      // Handle error display.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Render datasets.
      if (this.options.lib)
        this.datasets = new Datasets(this.app, {
          datasets: {
            more: true,
            items: [],
            query: {author_id: this.app.profile.user.id}
          },
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

    dragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.$el.addClass('dragging');
    },

    dragout: function (e) {
      this.$el.removeClass('dragging');
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      var files = e.originalEvent.dataTransfer.files;
      this.update(null, files);
      this.add(null, files);

      // Stop drag styles.
      this.$el.removeClass('dragging');
    },

    // Update new file input value
    update: function (e, files) {
      var files = files || e.target.files;
      var name;
      if (files.length === 0) {
        name = '';
        this.newFileSubmit.attr({disabled: "disabled"});
      } else {
        name = files[0].name;
        this.newFileSubmit.attr({disabled: false});
      }
      this.newFileInput.val(name);
    },

    // Create new dataset from file.
    add: function (e, files) {
      if (e) e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Start load indicator.
      this.newFileButtonSpin.start();
      this.newFileSubmit.addClass('loading');

      // Get the file.
      var files = files || this.newFile.get(0).files;

      if (files.length === 0) return false;
      var file = files[0];

      // Use a FileReader to read the file as a base64 string.
      var reader = new FileReader();
      reader.onload = _.bind(function () {

        // Check file type for any supported...
        // The MIME type could be text/plain or application/vnd.ms-excel
        // or a bunch of other options.  For now, switch to checking the
        // extension and consider improved validation down the road, particularly
        // as we add support for new file types
        var ext = file.name.split('.').pop();
        if (ext !== 'csv' && ext !== 'xls')
          return false;

        // Construct the payload to send.
        var payload = {
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
            ext: ext
          },
          base64: reader.result.replace(/^[^,]*,/,''),
        };

        // Create the dataset.
        this.app.rpc.do('insertSamples', payload,
            _.bind(function (err, res) {

          // Start load indicator.
          this.newFileButtonSpin.stop();
          this.newFileSubmit.removeClass('loading');
          this.newFileInput.val('');

          if (err) {
            this.newFileError.text(err);
            this.working = false;
            return;
          }

          // Publish new dataset.
          mps.publish('dataset/new', [res]);

          // Show alert
          mps.publish('flash/new', [{
            message: 'Successfully added a new data source: "'
                + res.title + ', ' + res.meta.channel_cnt + ' channel'
                + (res.meta.channel_cnt !== 1 ? 's':'') + '"',
            level: 'alert',
            sticky: false
          }]);

          if (!this.datasets)
            $.fancybox.close();

          // Ready for more.
          this.working = false;

        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
    },

  });
});
