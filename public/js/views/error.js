/*
 * Page view for errors.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../../templates/error.html',
], function ($, _, Backbone, mps, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    id: 'error',

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
    render: function (text) {

      // UnderscoreJS rendering.
      this.text = text;
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('#main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

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

    // Bind mouse events.
    events: {},

  });
});
