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
  'Spin',
  'views/error',
  'views/signin',
  'views/forgot',
  'views/save',
  'views/browser',
  'views/header',
  'views/home',
  'views/settings',
  'views/reset',
  'views/profile',
  'views/chart'
], function ($, _, Backbone, mps, rest, util, Spin, Error, Signin, Forgot,
      Save, Browser, Header, Home, Settings, Reset, Profile, Chart) {

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
      this.route('settings', 'settings', this.settings);
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

      // Init page spinner.
      this.spin = new Spin($('.page-spin'), {
        color: '#bfbfbf',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });
    },

    routes: {

      // Catch all
      '*actions': 'default'
    },

    render: function (service, data, secure, cb) {

      function _render(err, login) {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else if (login) this.header.render(true);

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
      if (typeof secure === 'function') {
        cb = secure;
        secure = false;
      }

      // Get a profile, if needed.
      rest.get(service, data, _.bind(function (err, pro) {
        if (err) {
          _render.call(this, err);
          this.page = new Error(this.app).render(err);
          this.spin.stop();
        }
        if (secure && !pro.user)
          return this.navigate('/', true);

        // Set the profile.
        var login = this.app.update(pro);
        _render.call(this, null, login);
      }, this));
    },

    start: function () {
      $(window).scrollTop(0);
      this.spin.start();
    },

    stop: function () {
      _.delay(_.bind(function () {
        this.spin.stop();
        $(window).scrollTop(0);
      }, this), 500);
    },

    home: function () {
      this.start();
      this.render('/service/home.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Home(this.app).render();
        this.stop();
      }, this));
    },

    reset: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
      }, this));
    },

    profile: function (username) {
      this.start();
      this.render('/service/user.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
        this.stop();
      }, this));
    },

    settings: function () {
      this.start();
      this.render('/service/settings.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.stop();
      }, this));
    },

    chart: function (un, slug) {
      this.start();
      var key = un && slug ? {un: un, slug: slug}: null;
      var state = key ? {key: key}: store.get('state');
      this.render('/service/chart.profile/', {state: state},
          _.bind(function (err) {
        if (err) return;
        this.page = new Chart(this.app).render();
        this.stop();
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
