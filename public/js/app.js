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
    var login = false;

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      this.profile.state = profile.state;
      if (profile.user && !this.profile.user) {
        this.profile.user = profile.user;
        login = true;
      }
      if (profile.sub && !this.profile.sub)
        this.profile.sub = profile.sub;
    } else
      this.profile = profile;

    // Pull out state, if exists.
    if (profile && profile.state) {
      store.set('state', profile.state);
      delete this.profile.state;
    }

    return login;
  }

  App.prototype.title = function (t1, t2, clear) {
    if (t1 === undefined) return;

    // Set the document title.
    var title = 'Skyline';
    if (clear)
      document.title = t1 !== '' ? t1: title;
    else document.title = t1 !== '' ? title + ' | ' + t1: title;

    // Set the app title.
    if (t2 === undefined) t2 = t1;
    mps.publish('title/set', [t2]);
  }

  App.prototype.logout = function () {

    // Update app profile.
    delete this.profile.user;
    delete this.profile.notes;
  }

  App.prototype.state = function (state) {
    store.set('state', state);
    mps.publish('state/change', [state]);
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App();
      $('body').removeClass('preload');
      app.router = new Router(app);
      Backbone.history.start({pushState: true});

      // For local dev.
      if (window.__s === '') window._app = app;
    }

  };
});
