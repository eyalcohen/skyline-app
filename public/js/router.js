/*
 * Handle URL paths and changes.
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
  'views/lists/flashes',
  'views/save',
  'views/finder',
  'views/header',
  'views/tabs',
  'views/footer',
  'views/dashboard',
  'views/splash',
  'views/settings',
  'views/reset',
  'views/profile',
  'views/chart',
  'views/static',
  'text!../templates/about.html',
  'text!../templates/contact.html',
  'text!../templates/privacy.html',
  'text!../templates/terms.html'
], function ($, _, Backbone, mps, rest, util, Spin, Error, Signin, Forgot,
    Flashes, Save, Finder, Header, Tabs, Footer, Dashboard, Splash, Settings,
    Reset, Profile, Chart, Static, aboutTemp, contactTemp, privacyTemp, termsTemp) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Clear stuff that comes back from facebook.
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1)
        try {
          window.history.replaceState('', '', window.location.pathname
              + window.location.search);
        } catch (err) {}

      // Determine if this is an embeded widget.
      var rx = new RegExp([window.location.host, 'embed'].join('/'), 'i');
      this.app.embed = rx.test(window.location.href);

      // Page routes
      this.route('embed/:username/:channel', 'chart', this.chart);
      this.route(':username/:id', 'chart', this.chart);
      this.route(':username/:id/:channel', 'chart', this.chart);
      this.route('embed/:username/views/:slug', 'chart', this.chart);
      this.route(':username/views/:slug', 'chart', this.chart);
      this.route(':username', 'profile', this.profile);
      this.route('reset', 'reset', this.reset);
      this.route('settings', 'settings', this.settings);
      this.route('about', 'about', this.about);
      this.route('contact', 'contact', this.contact);
      this.route('privacy', 'privacy', this.privacy);
      this.route('terms', 'terms', this.terms);
      this.route('', 'dashboard', this.dashboard);
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
        this.browser = new Finder(this.app, {lib: lib}).render();
      }, this));

      // Show the save modal.
      mps.subscribe('modal/save/open', _.bind(function (target) {
        this.save = new Save(this.app, {target: target}).render();
      }, this));

      // Show the forgot modal.
      mps.subscribe('modal/forgot/open', _.bind(function () {
        this.modal = new Forgot(this.app).render();
      }, this));

      // Update iframe src when embed code changes.
      mps.subscribe('embed/update', _.bind(function (str) {
        if (!this.app.embed) return;
        parent.document.__update({embed: '//' + str});
      }, this));

      // Init page spinner.
      var sopts = this.app.embed ?
          {color: '#8f8f8f', lines: 17, length: 7, width: 3, radius: 12}: 
          {color: '#3f3f3f', lines: 13, length: 3, width: 2, radius: 6};
      this.spin = new Spin($('.page-spin'), sopts);
    },

    routes: {

      // Catch all
      '*actions': 'default'
    },

    render: function (service, data, secure, cb) {

      function _render(err, login) {
        delete this.pageType;

        // Render page elements.
        if (!this.app.embed) {
          if (!this.header)
            this.header = new Header(this.app).render();
          else if (login) this.header.render(true);
          if (!this.footer)
            this.footer = new Footer(this.app).render();
        }

        // Start block messages.
        if(!this.flashes)
          this.flashes = new Flashes(this.app);

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
          // _render.call(this, err);
          this.page = new Error(this.app).render(err);
          this.stop();
        }
        if (secure && !pro.user)
          return this.navigate('/', true);

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);
      }, this));
    },

    renderTabs: function (params) {
      if (this.tabs) {
        this.tabs.params = params || {};
        this.tabs.render();
      } else
        this.tabs = new Tabs(this.app, params).render();
    },

    start: function () {
      $(window).scrollTop(0);
      $('body').addClass('loading');
      this.spin.start();
    },

    stop: function () {
      _.delay(_.bind(function () {
        this.spin.stop();
        $(window).scrollTop(0);
        $('body').removeClass('loading');
      }, this), 500);
    },

    getEventActions: function () {
      var feed = store.get('feed') || {};
      return feed.actions || 'all';
    },

    // Routes //

    dashboard: function () {
      this.start();
      var query = {actions: this.getEventActions()};
      this.render('/service/dashboard.profile', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.user) {
          this.renderTabs({tabs: [
            {title: 'Activity', href: '/', active: true},
            {title: 'Notifications', href: '/notifications'}
          ]});
          this.page = new Dashboard(this.app).render();
        } else {
          this.page = new Splash(this.app).render();
        }
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));

      if (this.app.profile && this.app.profile.user) {
        
      }
    },

    reset: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    profile: function (username) {
      this.start();
      this.render('/service/user.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
        this.stop();
        if (this.header)
          this.header.unnormalize();
      }, this));
    },

    settings: function () {
      this.start();
      this.render('/service/settings.profile', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    about: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'About', template: aboutTemp}).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    contact: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Contact', template: contactTemp}).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    privacy: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Privacy', template: privacyTemp}).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    terms: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Terms', template: termsTemp}).render();
        this.stop();
        if (this.header)
          this.header.normalize();
      }, this));
    },

    chart: function (un, slug, channelName) {
      this.start();
      var state = {};
      var path = window.location.pathname.toLowerCase();
      if (!slug || path.indexOf('/views/') !== -1) {
        var key = un && slug ? {un: un, slug: slug}: null;
        state = key ? {key: key}: store.get('state');
        if (this.header && key && !this.app.searchIsActive)
          this.header.unnormalize();
      } else {
        state.datasets = {};
        state.datasets[slug] = {index: 0};
        if (this.header)
          this.header.normalize();
      }
      if (this.app.profile && this.app.profile.user)
        state.user_id = this.app.profile.user.id;

      // NOTE: this should be the only place where state is directly set.
      // Elsewhere it should be done through App.prototype.state.
      store.set('state', state);
      var data = {state: state};
      if (this.app.embed) data.embed = true;
      this.render('/service/chart.profile/', data, _.bind(function (err) {
        if (err) return;
        this.pageType = 'chart';
        var chart = new Chart(this.app);
        if (channelName)
          mps.publish('dataset/requestOpenChannel', [channelName]);
        this.page = chart.render();
        if (this.header && !key) this.header.normalize();        
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
        if (this.header)
          this.header.normalize();
      }, this));
    }

  });

  return Router;
});
