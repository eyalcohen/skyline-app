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

    // Remote API config.
    this.apis = window.__s === '' ? {
      streams: 'http://localhost:8081'
    }: {
      streams: 'http://streams.skyline-data.com'
    };
  }

  App.prototype.getColors = function(colornum) {
    return this.colors[colornum % this.colors.length];
  }

  App.prototype.update = function (profile) {
    var login = false;

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      this.profile.notifications = profile.notifications;
      this.profile.sub = profile.sub;
      this.profile.state = profile.state;
      if (profile.user && !this.profile.user) {
        this.profile.user = profile.user;
        login = true;
      }
      if (profile.sub && !this.profile.sub) {
        this.profile.sub = profile.sub;
      }
    } else {
      this.profile = profile;
    }

    // Pull out state, if exists.
    if (profile && profile.state) {
      store.set('state', profile.state);
      delete this.profile.state;
    }

    return login;
  }

  App.prototype.title = function (str) {
    if (!str) {
      return;
    }

    // Set the document title.
    document.title = str;
  }

  App.prototype.logout = function () {

    // Update app profile.
    delete this.profile.user;
    delete this.profile.notes;
  }

  App.prototype.state = function (state, silent) {
    store.set('state', state);
    if (!silent) {
      mps.publish('state/change', [state]);
    }
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App();
      $('body').removeClass('preload');
      app.router = new Router(app);
      Backbone.history.start({pushState: true});

      // For local dev.
      if (window.__s === '') {
        window._app = app;
        console.log('skyline dev');
      } else {
        console.log('skyline ' + window.__s);
      }
    }

  };
});
