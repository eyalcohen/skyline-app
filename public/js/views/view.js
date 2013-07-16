/*
 * View view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'models/view',
  'text!../../../templates/view.html',
  'views/channels',
  'views/graph'
], function ($, _, Backbone, mps, util, units, View, template, Channels, Graph) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'view',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function (samples) {

      // Use model to store view data.
      this.model = new View(this.app, this);

      // Write the page title.
      var dataset = this.app.profile.content.page;
      mps.publish('title/set', ['"' + dataset.title + '", '
          + util.addCommas(Math.round(dataset.file.size / 1e3)) + ' KB, '
          + dataset.meta.channel_cnt
          + (dataset.meta.channel_cnt > 1 ? ' channels': ' channel')
          + ', ' + (new Date(dataset.meta.beg/1e3).format())
          + ' - ' + (new Date(dataset.meta.end/1e3).format())
          + ' by ' + dataset.author.displayName]);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('#main');

      // Initial sizing
      this.$el.height($(window).height() - this.$el.offset().top);

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Render children views.
      this.channels = new Channels(this.app, {parentView: this}).render();
      this.graph = new Graph(this.app, {parentView: this}).render();

      // Do resize on window change.
      $(window).resize(_.debounce(_.bind(this.resize, this), 50));

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
      this.channels.destroy();
      this.graph.destroy();
      this.remove();
    },

    resize: function () {
      var height = $(window).height() - this.$el.offset().top;
      this.$el.css({height: height});
    },

  });
});

