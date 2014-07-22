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
  'views/signup',
  'views/forgot',
  'views/lists/flashes',
  'views/save',
  'views/finder',
  'views/header',
  'views/tabs',
  'views/dashboard',
  'views/notifications',
  'views/splash',
  'views/settings',
  'views/upload',
  'views/reset',
  'views/profile',
  'views/library',
  'views/chart',
  'views/rows/dataset.event',
  'views/rows/view.event',
  'views/static',
  'views/how',
  'text!../templates/how.html',
  'text!../templates/mission.html',
  'text!../templates/contact.html',
  'text!../templates/privacy.html',
  'text!../templates/terms.html'
], function ($, _, Backbone, mps, rest, util, Spin, Error, Signin, Signup, Forgot,
    Flashes, Save, Finder, Header, Tabs, Dashboard, Notifications, Splash, Settings,
    Upload, Reset, Profile, Library, Chart, Dataset, View, Static, How, howTemp, missionTemp, contactTemp,
    privacyTemp, termsTemp) {

  function inIframe () {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function (app) {

      // Handle iFrame event.
      if (inIframe()) {
        this._navigate = this.navigate;
        this.navigate = function (path) {
          // parent.window.location.pathname = path;
          window.open(path, '_blank');
        }
      }

      // Save app reference.
      this.app = app;

      // Clear stuff that comes back from facebook.
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1) {
        if (window.location.hash.length === 0 || window.location.hash === '#_=_') {
          try {
            window.history.replaceState('', '', window.location.pathname
                + window.location.search);
          } catch (err) {}
        }
      }

      // Determine if this is an embedded widget.
      var rx = new RegExp([window.location.host, 'embed'].join('/'), 'i');
      this.app.embed = rx.test(window.location.href);

      // Page routes
      this.route(':username', 'profile', this.profile);
      this.route(':username/:id', 'dataset', this.dataset);
      this.route(':username/:id/:channel', 'chart', this.chart);
      this.route(':username/:id/note/:nid', 'note', this.note);
      this.route(':username/:id/:channel/chart', 'savedChart', this.savedChart);
      this.route(':username/:id/note/:nid/chart', 'savedNote', this.savedNote);
      this.route(':username/:id/config', 'dataset.config', this.datasetConfig);

      this.route(':username/views/:slug', 'view', this.view);
      this.route(':username/views/:slug/chart', 'chart', this.chart);
      this.route(':username/views/:slug/config', 'viewConfig', this.viewConfig);
      this.route(':username/views/:slug/note/:nid', 'note', this.note);

      this.route('embed/:username/:id', 'chart', this.chart);
      this.route('embed/:username/:id/:channel', 'chart', this.chart);
      this.route('embed/:username/views/:slug', 'chart', this.chart);

      this.route('upload/:fileId', 'upload', this.upload);

      this.route('reset', 'reset', this.reset);
      this.route('settings', 'settings', this.settings);
      this.route('notifications', 'notifications', this.notifications);
      this.route('how', 'how', this.how);
      this.route('mission', 'mission', this.mission);
      this.route('contact', 'contact', this.contact);
      this.route('privacy', 'privacy', this.privacy);
      this.route('terms', 'terms', this.terms);
      this.route('library', 'library', this.library);
      this.route('signin', 'signin', this.signin);
      this.route('signup', 'signup', this.signup);
      this.route('', 'dashboard', this.dashboard);

      // Show the finder.
      mps.subscribe('modal/finder/open', _.bind(function (search) {
        this.finder = new Finder(this.app, {search: search}).render();
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
          if (!this.header) {
            this.header = new Header(this.app).render();
          } else if (login) {
            this.header.render(true);
          }
        }

        // Start block messages.
        if(!this.flashes) {
          this.flashes = new Flashes(this.app);
        }

        // Callback to route.
        cb(err);
      }

      // Grab hash for comment.
      this.app.requestedCommentId = null;
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1) {
        var tmp = window.location.hash.match(/#c=([a-z0-9]{24})/i);
        if (tmp) {
          this.app.requestedCommentId = tmp[1];
        }
      } 

      // Kill the page view if it exists.
      if (this.page) {
        this.page.destroy();
      }

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
          $('.container').removeClass('wide');
          this.stop();
          this.page = new Error(this.app).render(err);
        }
        if (secure && !pro.user) {
          return this.navigate('/', true);
        }

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);
      }, this));
    },

    renderTabs: function (params) {
      if (this.tabs) {
        this.tabs.params = params || {};
        this.tabs.render();
      } else {
        this.tabs = new Tabs(this.app, params).render();
      }
    },

    start: function () {
      $(window).scrollTop(0);
      $('body').addClass('loading');
      this.spin.start();
    },

    stop: function () {
      var delay = this.app.embed ? 0: 500;
      _.delay(_.bind(function () {
        this.spin.stop();
        $(window).scrollTop(0);
        $('body').removeClass('loading');
      }, this), delay);
    },

    getEventActions: function () {
      var feed = store.get('feed') || {};
      return feed.actions || 'all';
    },

    // Routes //

    dashboard: function () {
      this.start();
      var query = {actions: this.getEventActions()};
      this.render('/service/dashboard', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.user) {
          $('.container').removeClass('wide').removeClass('landing');
          this.page = new Dashboard(this.app).render();
          this.renderTabs({tabs: [
            {title: 'Activity', href: '/', active: true},
            {title: 'Notifications', href: '/notifications'}
          ]});
        } else {
          $('.container').addClass('wide').addClass('landing');
          this.page = new Splash(this.app).render();
        }
        this.stop();
      }, this));
    },

    reset: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Password reset'});
    },

    profile: function (username) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      var query = {actions: this.getEventActions()};
      this.render('/service/user/' + username, query,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    notifications: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/notifications', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Notifications(this.app).render();
        this.renderTabs({tabs: [
          {title: 'Activity', href: '/'},
          {title: 'Notifications', href: '/notifications', active: true}
        ]});
        this.stop();
      }, this));
    },

    library: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/library', {}, _.bind(function (err) {
        if (err) return;
        this.page = new Library(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    signin: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Signin(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Log In', subtitle: 'Welcome back'});
    },

    signup: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Signup(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign Up', subtitle: 'It\'s free'});
    },

    settings: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/settings', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    upload: function (fileId) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/upload', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Upload(this.app, {fileId: fileId}).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    dataset: function (un, id) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/dataset/' + id, {},
          _.bind(function (err) {
        if (err) return;
        this.page = new Dataset({wrap: '.main'}, this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    datasetConfig: function (un, id) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/dataset/' + id, {},
          _.bind(function (err) {
        if (err) return;
        this.page = new Dataset({wrap: '.main', config: true}, this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    view: function (un, slug) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/view/' + un + '/' + slug, {},
          _.bind(function (err) {
        if (err) return;
        this.page = new View({wrap: '.main'}, this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    viewConfig: function (un, slug) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/view/' + un + '/' + slug, {},
          _.bind(function (err) {
        if (err) return;
        this.page = new View({wrap: '.main', config: true}, this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    how: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new How(this.app,
            {title: 'How It Works', template: howTemp}).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Skyline 101'});
    },

    mission: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Our Mission', template: missionTemp}).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Our Mission'});
    },

    contact: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Contact', template: contactTemp}).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Contact', subtitle: 'Get in touch'});
    },

    privacy: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Privacy', template: privacyTemp}).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Privacy Policy', subtitle: 'Last updated 7.27.2013'});
    },

    terms: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Terms', template: termsTemp}).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Terms and Conditions', subtitle: 'Last updated 7.27.2013'});
    },

    savedNote: function (un, slug, noteId) {
      this.note.call(this, un, slug, noteId, true);
    },

    note: function (un, slug, noteId, saved) {
      this.app.requestedNoteId = _.str.strLeft(noteId, '#');
      this.chart.call(this, un, slug, undefined, saved);
    },

    savedChart: function (un, slug, channelName) {
      this.chart.call(this, un, slug, channelName, true);
    },

    chart: function (un, slug, channelName, saved) {
      if (slug) {
        slug = _.str.strLeft(slug, '#');
      }
      if (channelName) {
        channelName = _.str.strLeft(channelName, '#');
      }
      this.start();

      this.renderTabs();
      $('.container').addClass('wide').removeClass('landing');

      var state = {};
      var path = window.location.pathname.toLowerCase();
      var state = store.get('state');
      if (!slug || path.indexOf('/views/') !== -1) {
        var key = un && slug ? {un: un, slug: slug}: null;
        if (key) {
          state = {key: key}
        }
      } else if (!saved || !state.datasets) {
        state = {};
        state.datasets = {};
        state.datasets[slug] = {index: 0};
      }

      if (this.app.profile && this.app.profile.user) {
        state.user_id = this.app.profile.user.id;
      }

      // NOTE: this should be the only place where state is directly set.
      // Elsewhere it should be done through App.prototype.state.
      store.set('state', state);
      var data = {state: state};
      if (this.app.embed) {
        data.embed = true;
      }
      this.render('/service/chart', data, _.bind(function (err) {
        if (err) return;
        this.pageType = 'chart';
        var chart = new Chart(this.app);
        if (channelName && (!saved ||  !state.datasets)) {
          mps.publish('dataset/requestOpenChannel', [channelName]);
        }
        this.page = chart.render();
        if (this.page.title) {
          this.renderTabs({html: this.page.title, center: true});
        }
        this.stop();
      }, this));
    },

    default: function () {
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.stop();
        this.page = new Error(this.app).render({
          code: 404,
          message: 'Sorry, this page isn\'t available'
        });
      }, this));
    }

  });

  return Router;
});
