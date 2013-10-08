/*
 * Chart view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'text!../../templates/chart.html',
  'views/lists/datasets',
  'views/graph'
], function ($, _, Backbone, mps, util, units, template, Datasets, Graph) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'chart',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/add', _.bind(function (did, channel) {
          this.graph.model.addChannel(did, channel);
        }, this)),
        mps.subscribe('channel/remove', _.bind(function (did, channel) {
          this.graph.model.removeChannel(did, channel);
        }, this))
      ];
    },

    // Draw our template from the profile JSON.
    render: function (samples) {

      // Use model to store view data.
      this.model = new Backbone.Model;

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('div.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.sidePanel = this.$('.side-panel');
      this.lowerPanel = this.$('.lower-panel');

      // Render children views.
      this.datasets = new Datasets(this.app, {parentView: this});
      this.graph = new Graph(this.app, {parentView: this}).render();

      // Do resize on window change.
      this.resize();
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));

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
      this.datasets.destroy();
      this.graph.destroy();
      this.remove();
    },

    resize: function () {
      var height = $(window).height() - $('footer').height() - this.$el.offset().top;
      height = Math.max(height, 605);
      this.$el.css({height: height});
    },

  });
});

