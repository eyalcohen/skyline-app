/*!
 * Copyright 2011 Mission Motors
 */

// include global server-client shared resources
window._ = require('underscore');
window.Step = require('step');
window.DNode = require('dnode');

// include client deps and build app root
requirejs(['libs/json2',
    'libs/modernizr-1.7.min',
    'libs/backbone-min',
    'libs/store.min',
    'libs/spin.min'],
    function () {
  window.App = {
    debug: true,
    start: function () {
      DNode().connect({ disconnect: App.reconnect }, function (remote) {
        try {
          App.api = remote;
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

          requirejs(['models', 'collections', 'views', 'sample-cache',
              'router', 'backbone-sync', 'backbone-super'],
              function (models, collections, views, SampleCache, Router) {
            App.models = models;
            App.collections = collections;
            App.views = views;
            App.sampleCache = new SampleCache();
            // App.defaultChannel = {
            //   channelName: 'mc.motorSpeed_RPM',
            //   humanName: 'Motor Speed',
            //   shortName: 'motorSpeed_RPM',
            //   title: 'Motor Speed',
            //   type: 'float',
            //   units: 'RPM',
            //   
            //   // channelName: "mc/motorSpeed"
            //   // humanName: "mc/motorSpeed"
            //   // shortName: "motorSpeed"
            //   // title: "motorSpeed"
            //   // type: "float"
            //   
            //   // channelName: 'gps.speed_m_s',
            //   // humanName: 'GPS Speed',
            //   // shortName: 'speed_m_s',
            //   // type: 'float',
            //   // units: 'm/s',
            //   // title: 'GPS Speed',
            // };

            App.router = new Router();
            Backbone.history.start({
              pushState: true,
              silent: true,
            });
            // SP: This will set the URL, but we must ensure
            // the server can provide the same route if 
            // asked directly.
            //// App.router.navigate('somewhere');

            App.login = new views.LoginView();
            App.logout = new views.LogoutView();
            App.subscribe('UserWasAuthenticated', App.buildDash);
            var loginOpts = {
              first: true,
              report: 'Please log in.',
              type: 'message',
            };
            if (_.isEmpty(App.user)) {
              App.publish('NotAuthenticated', [loginOpts]);
            } else {
              App.api.authenticate(App.user, function handleAuthResult(err) {
                if (err) App.publish('NotAuthenticated', [loginOpts]);
                else App.publish('UserWasAuthenticated');
              });
            }
          });
        } catch (err) {
          console.error('Error in App.start: ' + err + '\n' + err.stack);
        }
      });
    },

    reconnect: function () {
      console.warn('The server went away. Trying to reconnect ...');
      if (App.reconnecter)
        clearInterval(App.reconnecter);
      App.reconnecter = setInterval(function () {
        DNode.connect({ disconnect: App.reconnect }, function (remote) {
          App.api = remote;
          clearInterval(App.reconnecter);
          App.reconnecter = null;
          App.api.authenticate(App.user, function (err) {
            if (err) {
              App.publish('NotAuthenticated');
              console.warn('Server reconnected. User NOT authorized!');
            } else {
              console.warn('Server reconnected. User authorized!');
            }
          });
        });
      }, 500);
    },

    buildDash: function () {
      App.mainView = new App.views.MainView().render();
      App.dashView = new App.views.DashView({
        targetClass: 'dashboard',
      }).render({
        title: 'Dashboard',
        active: true,
        tabClosable: false,
        left: 30
      }, 'dash.jade');
      // // TODO: check if user is ADMIN first!
      // App.userCollection =
      //     new App.collections.UserCollection().fetch();
      // App.publish('AppReady');
    }

  };
  requirejs.ready(function () {
    // var opts = {
    //   lines: 12, // The number of lines to draw
    //   length: 30, // The length of each line
    //   width: 4, // The line thickness
    //   radius: 40, // The radius of the inner circle
    //   color: '#000', // #rgb or #rrggbb
    //   speed: 1, // Rounds per second
    //   trail: 60, // Afterglow percentage
    //   shadow: false // Whether to render a shadow
    // };
    // var spinner = new Spinner(opts).spin($('.folder').get(0));
    App.start();
  });
});

