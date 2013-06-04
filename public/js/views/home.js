/*
 * Page view for home.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Delivery',
  'mps',
  'util'
], function ($, _, Backbone, Delivery, mps, rpc, util) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#main',
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

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // Safe el refs.
      this.dropZone = this.$('#dnd');

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

      // Stop drag styles.
      this.dropZone.removeClass('dragging');

      // Don't do anything if already doing it.
      if (this.uploading) return false;

      // Get the files, if any.
      var files = e.originalEvent.dataTransfer.files;
      if (files.length === 0) return;

      // Create a delivery object.
      var delivery = new Delivery(this.app.socket);
      
      delivery.on('delivery.connect', function (delivery) {
        delivery.send(files[0]);
      });

      delivery.on('send.success', function (uuid) {
        // console.log(uuid);
      });

      // var data = new FormData(this.postForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      // var list = [];
      // _.each(files, function (file) {
      //   list.push('<span>- ', file.name + ' ('
      //       + util.addCommas(file.size) + ' bytes)', '</span>');
      //   if (data && typeof file === 'object') data.append('file', file);
      // });
      // this.postFiles.html(list.join('')).show();

      // Use formData object if exists (dnd only)
      
      // console.log(files);

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
      this.empty();
    },

    // Bind mouse events.
    events: {},

  });
});
