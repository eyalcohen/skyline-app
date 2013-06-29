/*
 * Page view for home.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../../templates/home.html',
  'Spin'
], function ($, _, Backbone, mps, util, template, Spin) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    id: 'home',
    uploading: false,

    // Module entry point:
    initialize: function (app) {

      // Save app ref.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('#main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // Init the load indicator.
      this.spin = new Spin(this.$('.spinner'));

      // Safe el refs.
      this.dropZone = this.$el;

      // Drag & drop events.
      this.dropZone.on('dragover', _.bind(this.dragover, this))
          .on('dragleave', _.bind(this.dragout, this))
          .on('drop', _.bind(this.drop, this));

      return this;
    },

    dragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.dropZone.addClass('dragging');
    },

    dragout: function (e) {
      this.dropZone.removeClass('dragging');
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Start the spinner.
      this.spin.start();

      // Stop drag styles.
      this.dropZone.removeClass('dragging');

      // Don't do anything if already doing it.
      if (this.uploading) return false;

      // Get the files, if any.
      var files = e.originalEvent.dataTransfer.files;
      if (files.length === 0) return;

      // Just use the first one for now.
      // TODO: drag drop multiple files -> datasets.
      var file = files[0];

      // Use a FileReader to read the file as a base64 string.
      var reader = new FileReader();
      reader.onload = _.bind(function () {

        // Construct the payload to send.
        var data = {
          name: file.name,
          size: file.size,
          type: file.type,
          base64: reader.result.replace(/^[^,]*,/,''),
        };

        this.app.rpc.do('insertCSVSamples', data,
            _.bind(function (err, res) {
          if (err) return console.error(err);

          // Stop the spinner.
          this.spin.stop();

          // Go to the graph view.
          var route = ['/username', res.did].join('/');
          route += '?b=' + res.beg + '&e=' + res.end;
          this.app.router.navigate(route, {trigger: true});

        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
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
      this.remove();
    },

    // Bind mouse events.
    events: {},

  });
});
