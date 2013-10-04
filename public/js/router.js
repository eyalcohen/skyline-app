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
  'views/save',
  'views/header',
  'views/home',
  'views/profile',
  'views/chart'
], function ($, _, Backbone, mps, rest, util, Error, Signin, Save,
      Header, Home, Profile, Chart) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Page routes
      this.route(':username/views/:slug', 'view', this.view);
      this.route(':username', 'profile', this.profile);
      this.route('chart', 'chart', this.chart);
      this.route('', 'home', this.home);

      // Fullfill navigation request from mps.
      mps.subscribe('navigate', _.bind(function (path) {
        this.navigate(path, {trigger: true});
      }, this));

      // Kill user specific views.
      mps.subscribe('user/delete', _.bind(function () {

      }, this));

      // Show the signin modal.
      mps.subscribe('user/signin/open', _.bind(function () {
        this.signin = new Signin(this.app).render();
      }, this));

      // Show the save modal.
      mps.subscribe('view/save/open', _.bind(function () {
        this.save = new Save(this.app, {
          datasets: this.page.graph.model.getChannelsByDataset(),
          meta: this.page.graph.getVisibleTime()
        }).render();
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

    chart: function () {
      var state = store.get('state');
      this.render('/service/chart.profile/', {state: state}, _.bind(function (err) {
        if (err) return;
        this.page = new Chart(this.app).render();
      }, this));
    },

    view: function (username, slug) {
      var key = [username, slug].join('/');
      this.render('/service/view.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Chart(this.app, {view: true}).render();
      }, this));
    },

    default: function (actions) {
      console.warn('No route:', actions);
    }

  });

  return Router;
});
