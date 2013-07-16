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
  'views/rows/dataset'
], function ($, _, List, mps, rpc, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.datasets',
    working: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('dataset.new', _.bind(this.collect, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.datasets.items);
    },

    setup: function () {

      // Safe el refs.
      this.dropZone = this.$('.dnd').show();

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
      if (dataset.author.id === this.parentView.model.id)
        this.collection.unshift(dataset);
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove();
        this.collection.remove(view.model);
      }
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

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Stop drag styles.
      this.dropZone.removeClass('dragging');

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
        if (file.type !== 'text/csv')
          return false;

        // Construct the payload to send.
        var payload = {
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
          },
          base64: reader.result.replace(/^[^,]*,/,''),
        };

        // Mock dataset.
        var data = {
          id: -1,
          author: this.app.profile.user,
          updated: new Date().toISOString(),
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
          },
          meta: {
            beg: 0,
            end: 0,
            channel_cnt: 0,
          }
        };

        // Optimistically add dataset to page.
        this.collection.unshift(data);

        // Create the dataset.
        this.app.rpc.do('insertCSVSamples', payload,
            _.bind(function (err, res) {

          if (err)
            return console.error(err);

          if (res.created === false) {

            // Remove row.
            this.working = false;
            return this._remove({id: -1});
          }

          // Update the dataset id.
          var dataset = this.collection.get(-1);
          dataset.set('client_id', res.client_id);
          dataset.set('meta', res.meta);
          dataset.set('id', res.id);

          // Ready for more.
          this.working = false;

        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
    },

  });
});
