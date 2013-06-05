/*
 * Skyline application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'rpc'
], function ($, _, Backbone, Router, rpc) {

  var App = function () {

    // Save connection to server.
    this.rpc = rpc.init();
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
