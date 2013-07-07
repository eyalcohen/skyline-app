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
  'views/signin',
  'views/header',
  'views/home',
  'views/profile',
  'views/graph'
], function ($, _, Backbone, mps, rest, util, Signin, Header, Home,
      Profile, Graph) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Page routes
      this.route(':username/:id', 'graph', this.graph);
      this.route(':username', 'profile', this.profile);
      this.route('', 'home', this.home);

      // Fullfill navigation request from mps.
      mps.subscribe('navigate', _.bind(function (path) {
        this.navigate(path, {trigger: true});
      }, this));

      // Kill the notifications view.
      mps.subscribe('user/delete', _.bind(function () {

      }, this));

      // Show the signin modal.
      mps.subscribe('user/signin/open', _.bind(function () {
        this.signin = new Signin(this.app).render();
      }, this));
    },

    routes: {
      // Catch all
      '*actions': 'default'
    },

    render: function (service, cb) {

      function _render() {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();

        // Callback to route.
        cb();
      }

      // Kill the page view if it exists.
      if (this.page)
        this.page.destroy();

      if (typeof service === 'function') {
        cb = service;
        return _render.call(this);
      }

      // Check if a profile exists already.
      var query = {};

      // Get a profile, if needed.
      rest.get(service, query,
          _.bind(function (err, pro) {
        if (err) return console.error(err);

        // Set the profile.
        this.app.update(pro);
        _render.call(this);

      }, this));
    },

    home: function () {
      this.render('/service/home.profile', _.bind(function () {
        this.page = new Home(this.app).render();
      }, this));
    },

    profile: function (username) {
      this.render('/service/user.profile/' + username,
          _.bind(function () {
        this.page = new Profile(this.app).render();
      }, this));
    },

    settings: function () {
      this.render('/service/settings.profile', _.bind(function () {
        this.page = new Settings(this.app).render();
      }, this));
    },

    dataset: function (username, id) {
      var key = [username, id].join('/');
      this.render('/service/dataset.profile/' + key, _.bind(function () {
        this.page = new Dataset(this.app).render(true);
      }, this));

      // this.page = new Graph(this.app, {
      //   datasetId: _.str.strLeft(id, '?'),
      //   visibleTime: {
      //     beg: util.getParameterByName('b'),
      //     end: util.getParameterByName('e')
      //   }
      // }).render();
    },

    default: function (actions) {
      console.warn('No route:', actions);
    }

  });

  return Router;
});
