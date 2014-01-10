/*
 * Footer view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps'
], function ($, _, Backbone, mps) {
  return Backbone.View.extend({

    el: '.footer',

    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function (login) {

      // Done rendering ... trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Shell event.
      this.delegateEvents();
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate'
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});
