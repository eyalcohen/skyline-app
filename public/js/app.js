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

    // TODO: Do this only on localhost.
    window.rpc = rpc;
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
