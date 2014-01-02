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

    // App-wide colors.
    this.colors = [
      "#3cb4e7",
      "#ffb40f",
      "#e66ec8",
      "#71c72a",
      "#7877c1",
    ];

    // For local dev.
    if (window.__s === '') {
      window._rpc = rpc;
      window._rest = rest;
      window._mps = mps;
    }
  }

  App.prototype.getColors = function(colornum) {
    return this.colors[colornum % this.colors.length];
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      if (profile.user && !this.profile.user) {
        this.profile.user = profile.user;
        return true;
      }
    } else
      this.profile = profile;

    // Pull out state, if exists.
    if (profile && profile.state) {
      store.set('state', profile.state);
      delete this.profile.state;
    }

    return false;
  }

  App.prototype.title = function (t1, t2) {
    if (t1 === undefined) return;

    // Set the document title.
    var title = 'Skyline';
    document.title = t1 !== '' ? title + ' | ' + t1: title;

    // Set the app title.
    if (t2 === undefined) t2 = t1;
    mps.publish('title/set', [t2]);
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
