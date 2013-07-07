/*
 * Page view for profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/user',
  'text!../../../templates/profile.html',
  'views/lists/datasets',
  'Spin'
], function ($, _, Backbone, mps, util, User, template, Datasets, Spin) {

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

      // Use a model for the main content.
      this.model = new User(this.app.profile.content.page);

      // Set page title
      this.app.title(this.model.get('displayName'));

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('#main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Init the load indicator.
      this.spin = new Spin(this.$('.profile-spinner'));
      this.spin.target.hide();

      // Safe el refs.
      this.dropZone = this.$('.dnd');

      // Drag & drop events.
      this.dropZone.on('dragover', _.bind(this.dragover, this))
          .on('dragleave', _.bind(this.dragout, this))
          .on('drop', _.bind(this.drop, this));

      // Render datasets.
      // this.datasets = new Datasets(this.app, {parentView: this, reverse: true});

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

        // Check file type... only want CSVs.
        if (file.type !== 'text/csv') {
          this.spin.stop();
          return false;
        }

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
          var route = ['/sanderpick', res.did].join('/');
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

  });
});
