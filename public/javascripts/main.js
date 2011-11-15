/*!
 * Copyright 2011 Mission Motors
 */

// include global server-client shared resources
window._ = require('underscore');
window.Step = require('step');
window.DNode = require('dnode');

// include client deps and build app root
requirejs(['libs/domReady',
    'libs/json2',
    'libs/modernizr-1.7.min',
    'libs/backbone-min',
    'libs/store.min',
    'libs/spin.min'],
    function (domReady) {
  window.App = {
    debug: true,
    start: function () {
      var firstConnect = true;
      DNode().connect({ disconnect: App.disconnect }, function (remote) {
        App.api = remote;

        if (firstConnect) {
          try {
            firstConnect = false;
            App.store = store;
            App.engine = require('jadeify');
            App.publish = require('./minpubsub').publish;
            App.subscribe = require('./minpubsub').subscribe;
            App.unsubscribe = require('./minpubsub').unsubscribe;
            App.shared = require('./shared_utils');
            App.user = App.store.get('user') || {};
            App.regions = {
              header: $('header'),
              main: $('#main'),
              footer: $('footer'),
              menu: $('nav ul'),
            };

            requirejs(['models', 'collections', 'views', 'util',
                'sample-cache', 'state-monitor',
                'router', 'backbone-sync', 'backbone-super'],
                function (models, collections, views, util,
                          SampleCache, StateMonitor, Router) {

              App.models = models;
              App.collections = collections;
              App.views = views;
              App.util = util;
              App.sampleCache = new SampleCache();
              App.stateMonitor = new StateMonitor();
              App.router = new Router();
              Backbone.history.start({
                pushState: true,
                silent: true,
              });

              App.login = new views.LoginView();
              App.logout = new views.LogoutView();
              App.loginOpts = {
                first: true,
                report: 'Please log in.',
                type: 'message',
              };
              App.subscribe('UserWasAuthenticated', App.build);

              if (_.isEmpty(App.user)) {
                App.publish('NotAuthenticated', [App.loginOpts]);
                App.loading.stop();
              } else {
                App.api.authenticate(App.user, function handleAuthResult(err) {
                  if (err) App.publish('NotAuthenticated', [App.loginOpts]);
                  else App.publish('UserWasAuthenticated');
                });
              }
            });
          } catch (err) {
            console.error('Error in App.start: ' + err + '\n' + err.stack);
          }
        } else {
          if (!_.isEmpty(App.user)) {
            App.api.authenticate(App.user, function (err) {
              if (err) {
                console.warn('Server reconnected. User NOT authorized!');
                App.publish('NotAuthenticated', [App.loginOpts]);
              } else {
                console.warn('Server reconnected. User authorized!');
                App.publish('DNodeReconnectUserAuthorized');
              }
            });
          }
        }
      });
    },

    disconnect: function () {
      console.warn('The server went away.');
    },

    build: function () {
      // App.dashReady = ;
      App.subscribe('AppReady', _.after(2, _.once(App.dashReady)));
      App.mainView = new App.views.MainView().render();
      App.dashView = new App.views.DashView({
        targetClass: 'dashboard',
      }).render({
        title: 'Dashboard',
        active: true,
        tabClosable: false,
        left: 30
      }, 'dash.jade');
      App.editorView = new App.views.EditorView().render();
      App.loading.stop();
      // // TODO: check if user is ADMIN first!
      // App.userCollection =
      //     new App.collections.UserCollection().fetch();
      // App.publish('AppReady');
    },

    dashReady: function () {
      // TODO: Make this work without the delay.
      _.delay(function () {
        var state = $('#main').data('state');
        if (state)
          App.stateMonitor.setState(state);
      }, 500);
    },

    Loader: function () {
      var target = document.getElementById('loading');
      return {
        start: function () {
          if (!App.spinner) {
            App.spinner = new Spinner({
              lines: 12,
              length: 7,
              width: 4,
              radius: 40,
              color: '#333',
              speed: 1,
              trail: 60,
              shadow: false,
            });
          }
          App.spinner.spin(target);
          $(target).show();
          return this;
        },
        stop: function () {
          if (App.spinner) {
            App.spinner.stop();
          }
          $(target).hide();
          return this;
        },
      }
    },

  };
  domReady(function () {
    App.loading = new App.Loader().start();
    App.start();
  });
});

