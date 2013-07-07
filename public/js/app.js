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

    // App model subscriptions.
    mps.subscribe('member/delete', _.bind(this.logout, this))

    // TODO: Do this only on localhost.
    window._rpc = rpc;
    window._rest = rest;
    window._mps = mps;
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile)
      this.profile.content = profile.content;
    else
      this.profile = profile;
  }

  App.prototype.title = function (str) {

    // Set the document title.
    document.title = 'Skyline | ' + str;
  }

  App.prototype.logout = function () {

    // Update app profile.
    delete this.profile.member;
    delete this.profile.notes;
    delete this.profile.transloadit;
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
