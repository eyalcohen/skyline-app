/*
 * Library Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/dataset.library.html',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, Row, template, confirm) {
  return Row.extend({

    tagName: 'div',

    attributes: function () {
      return _.defaults({class: 'library-dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // Socket subscriptions
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));
    },

    setup: function () {
      Row.prototype.setup.call(this);

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        // This is a hack to allow parent pages to render before drawing SVGs
        _.delay(_.bind(common.drawChannel, this, c), 50);
      }, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
      'click .event-channel-delete': 'deleteChannel'
    },

    navigate: function (e) {
      e.preventDefault();
      if ($(e.target).hasClass('event-channel-delete')
          || $(e.target).hasClass('icon-cancel')) return;

      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this dataset forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the doc.
        rest.delete('/api/datasets/' + this.model.id,
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

    deleteChannel: function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Delete the doc.
      var li = $(e.target).closest('li');
      rest.delete('/api/channels/' + li.data('id'),
          {}, _.bind(function (err, data) {
        if (err) return console.log(err);
        li.remove();
      }, this));

      return false;
    },

    removeChannel: function (data) {
      var li = $('li[data-id=' + data.id + ']').remove();
    }

  });
});
