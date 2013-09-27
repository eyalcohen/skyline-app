/*
 * Skyline application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'mps',
  'rpc',
  'rest'
], function ($, _, Backbone, Router, mps, rpc, rest) {

  var App = function () {

    // Save connection to server.
    this.rpc = rpc.init();

    // Location of static assets
    this.cfuri = 'https://d2t5v5bzkrqpjm.cloudfront.net';

    // App model subscriptions.
    mps.subscribe('user/delete', _.bind(this.logout, this));

    // TODO: Do this only on localhost.
    window._rpc = rpc;
    window._rest = rest;
    window._mps = mps;
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      if (profile.user && !this.profile.user) {
        this.profile.user = profile.user;
        this.profile.notes = profile.notes;
        return true;
      }
    } else
      this.profile = profile;

    return false;
  }

  App.prototype.title = function (str) {

    // Set the document title.
    document.title = 'Skyline | ' + str;
  }

  App.prototype.logout = function () {

    // Update app profile.
    delete this.profile.user;
    delete this.profile.notes;
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
