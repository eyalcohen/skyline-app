/*
 * Overview view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'Rickshaw'
], function ($, _, Backbone, mps, Rickshaw) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    el: '.overview',

    // Module entry point.
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw template.
    render: function () {

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      
    },

    // Misc. setup.
    setup: function () {

      // Init Rickshaw.
      this.graph = new Rickshaw.Graph({
        element: this.el,
        renderer: 'area',
        stroke: true,
        series: [{
          data: [{ x: 0, y: 40 }, { x: 1, y: 49 }],
          color: 'steelblue'
        }, {
          data: [{ x: 0, y: 40 }, { x: 1, y: 49 }],
          color: 'lightblue'
        }]
      });
      this.graph.render();

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
      this.remove();
    },

  });
});

