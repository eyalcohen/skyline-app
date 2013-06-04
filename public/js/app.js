/*
 * Skyline application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router'
], function ($, _, Backbone, Router) {

  var App = function () {

    // Attach a socket connection.
    this.socket = io.connect('http://localhost:8080');
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App();
      app.router = new Router(app);
      Backbone.history.start({pushState: true});
    }
    
  };
});
