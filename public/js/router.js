/*!
 * Copyright 2011 Mission Motors
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'views/error',
  'views/signin',
  'views/forgot',
  'views/save',
  'views/browser',
  'views/header',
  'views/home',
  'views/reset',
  'views/profile',
  'views/chart'
], function ($, _, Backbone, mps, rest, util, Error, Signin, Forgot,
      Save, Browser, Header, Home, Reset, Profile, Chart) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Clear stuff that comes back from facebook.
      if (window.location.hash !== '')
        try {
          window.history.replaceState('', '', window.location.pathname
              + window.location.search);
        } catch (err) {}

      // Page routes
      this.route(':username/views/:slug', 'view', this.chart);
      this.route(':username', 'profile', this.profile);
      this.route('chart', 'chart', this.chart);
      this.route('reset', 'reset', this.reset);
      this.route('', 'home', this.home);
      this.route('_blank', 'blank', function(){});

      // Fullfill navigation request from mps.
      mps.subscribe('navigate', _.bind(function (path) {
        this.navigate(path, {trigger: true});
      }, this));

      // Kill user specific views.
      mps.subscribe('user/delete', _.bind(function () {
        // this.notifications.destroy();
      }, this));

      // Show the signin modal.
      mps.subscribe('modal/signin/open', _.bind(function () {
        this.signin = new Signin(this.app).render();
      }, this));

      // Show the browser modal.
      mps.subscribe('modal/browser/open', _.bind(function (lib) {
        this.browser = new Browser(this.app, {lib: lib}).render();
      }, this));

      // Show the save modal.
      mps.subscribe('modal/save/open', _.bind(function (lib) {
        this.save = new Save(this.app).render();
      }, this));

      // Show the forgot modal.
      mps.subscribe('modal/forgot/open', _.bind(function () {
        this.modal = new Forgot(this.app).render();
      }, this));
    },

    routes: {

      // Catch all
      '*actions': 'default'
    },

    render: function (service, data, cb) {

      function _render(err) {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();

        // Callback to route.
        cb(err);
      }

      // Kill the page view if it exists.
      if (this.page)
        this.page.destroy();

      if (typeof service === 'function') {
        cb = service;
        return _render.call(this);
      }
      if (typeof data === 'function') {
        cb = data;
        data = {};
      }

      // Get a profile, if needed.
      rest.get(service, data, _.bind(function (err, pro) {
        if (err) {
          _render.call(this, err);
          return this.page = new Error(this.app).render(err);
        }

        // Set the profile.
        this.app.update(pro);
        _render.call(this);

      }, this));
    },

    home: function () {
      this.render('/service/home.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Home(this.app).render();
      }, this));
    },

    reset: function () {
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
      }, this));
    },

    profile: function (username) {
      this.render('/service/user.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
      }, this));
    },

    settings: function () {
      this.render('/service/settings.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
      }, this));
    },

    chart: function (un, slug) {
      var key = un && slug ? {un: un, slug: slug}: null;
      var state = key ? {key: key}: store.get('state');
      this.render('/service/chart.profile/', {state: state},
          _.bind(function (err) {
        if (err) return;
        this.page = new Chart(this.app).render();
      }, this));
    },

    default: function () {
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Error(this.app).render({
          code: 404,
          message: 'Sorry, this page isn\'t available'
        });
      }, this));
    }

  });

  return Router;
});
