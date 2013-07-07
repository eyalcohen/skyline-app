/*
 * Datasets List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/datasets.html',
  'collections/datasets',
  'views/rows/dataset',
  'Spin'
], function ($, _, List, mps, rpc, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.datasets',
    uploading: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      // this.app.socket.subscribe('post-' + this.parentView.model.id)
      //     .bind('dataset.new', _.bind(this.collect, this));

      // Reset the collection.
      this.collection.reset(this.parentView.model.get('datasets'));
    },

    setup: function () {

      // Init the load indicator.
      this.spin = new Spin(this.$('#datasets_spin'));
      this.spin.target.hide();

      // Safe el refs.
      this.dropZone = this.$('.dnd');

      // Drag & drop events.
      this.dropZone.on('dragover', _.bind(this.dragover, this))
          .on('dragleave', _.bind(this.dragout, this))
          .on('drop', _.bind(this.drop, this));

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      'click .datasets-signin': 'signin'
    },

    // Collect new datasets from socket events.
    collect: function (dataset) {
      this.collection.unshift(dataset);
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('user/signin/open');
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

  });
});
