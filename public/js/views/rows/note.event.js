/*
 * Note event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'common',
  'mps',
  'util',
  'models/note',
  'text!../../../templates/rows/note.event.html',
  'views/lists/comments'
], function ($, _, Backbone, common, mps, util, Model, template, Comments) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-note'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model);
      this.parentView = options.parentView;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      // Socket subscriptions.
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.$el.html(this.template.call(this, {util: util}));
      this.$el.prependTo(this.parentView.$('.event-right'));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Render lists.
      this.comments = new Comments(this.app, {parentView: this, type: 'note'});

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        // This is a hack to allow parent pages to render before drawing SVGs
        _.delay(_.bind(common.drawChannel, this, c), 50);
      }, this));

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // For rendering tooltips
      this.parentView.$('.tooltip').tooltipster({delay: 600, multiple: true});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.comments) {
        this.comments.destroy();
      }
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    removeChannel: function (data) {
      var li = $('li[data-id=' + data.id + ']').remove();
    },

    when: function () {
      if (!this.model.get('created')) {
        return;
      }
      if (!this.time) {
        this.time = this.$('time.created:first');
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
