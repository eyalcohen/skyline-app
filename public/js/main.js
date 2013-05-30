/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({

  // Library paths:
  paths: {
    jQuery: 'libs/jquery/jquery',
    Underscore: 'libs/underscore/underscore',
    Backbone: 'libs/backbone/backbone',
    Modernizr: 'libs/modernizr/modernizr',
    mps: 'libs/minpubsub/minpubsub',
    Spin: 'libs/spin/spin'
  },

  // Dependency mapping:
  shim: {
    Underscore: {
      exports: '_'
    },
    Backbone: {
      deps: ['jQuery', 'Underscore'],
      exports: 'Backbone'
    },
    Modernizr: {
      exports: 'Modernizr'
    },
    mps: {
      deps: ['jQuery', 'Underscore'],
      exports: 'mps'
    },
    Spin: {
      exports: 'Spin'
    },
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});










// /*!
//  * Copyright 2011 Mission Motors
//  */

// // can set with hash tag
// window.DEMO = false;

// // include global server-client shared resources
// window._ = require('underscore');
// window.Step = require('step');
// window.DNode = require('dnode');

// // include client deps and build app root
// requirejs(['libs/domReady',
//     'libs/json2',
//     'libs/modernizr-1.7.min',
//     'libs/backbone',
//     'libs/store.min',
//     'libs/spin.min'],
//     function (domReady) {
//   window.App = {
//     debug: true,
//     start: function () {
//       var firstConnect = true;
//       DNode.connect({
//         disconnect: App.disconnect,
//         'max reconnection attempts': Infinity,
//         'reconnection limit': 5000,  // 5 seconds
//       }, function (remote, connection) {
//         connection.on('error', function (err) {
//           console.error('DNode callback threw exception:\n' +
//                         (err.stack || err));
//         });
//         App.api = remote;

//         if (firstConnect) {
//           try {
//             firstConnect = false;
//             App.store = store;
//             App.engine = require('jadeify');
//             App.publish = require('./minpubsub').publish;
//             App.subscribe = require('./minpubsub').subscribe;
//             App.unsubscribe = require('./minpubsub').unsubscribe;
//             App.shared = require('./shared_utils');
//             App.units = require('./units');
//             App.regions = {
//               header: $('header'),
//               main: $('#main'),
//               footer: $('footer'),
//               menu: $('nav ul'),
//             };

//             requirejs(['models', 'collections', 'views', 'util',
//                 'easing', 'sample-cache', 'state-monitor',
//                 'router', 'date', 'backbone-sync', 'backbone-super'],
//                 function (models, collections, views, util,
//                           easing, SampleCache, StateMonitor, Router) {

//               App.models = models;
//               App.collections = collections;
//               App.views = views;

//               App.util = util;
//               App.easing = easing;

//               App.vehicleTabModels = {};  // Map from tabId to VehicleTabModel.
//               App.sampleCache = new SampleCache();
//               App.stateMonitor = new StateMonitor();
//               App.router = new Router();

//               App.login = new views.LoginView();
//               App.logout = new views.LogoutView();
//               App.subscribe('UserWasAuthenticated', App.build);
//               authorize(false);

//               window.DEMO = window.DEMO || App.util.HashSearch.keyExists('demo');
//             });
//           } catch (err) {
//             console.error('Error in App.start: ' + err + '\n' + err.stack);
//           }
//         } else authorize(true);

//         function authorize(reconnect) {
//           App.api.authorize(function (err, user) {
//             if (err) {
//               console.warn('Server connected. User NOT authorized!');
//               if ('Error: User and Session do NOT match!' === err) {
//                 App.publish('NotAuthenticated', [{
//                   report: 'Oops! Something bad happened so you were Signed Out. Please Sign In again.',
//                   type: 'error',
//                 }]);
//               } else if ('Session has no User.') {
//                 var opts = {
//                   first: !reconnect,
//                   report: '',
//                   type: 'message',
//                 };
//                 if(App.util.HashSearch.keyExists('oops')) {
//                   opts.report = 'Incorrect email or password.';
//                   opts.type = 'error';
//                   App.router.navigate('', { replace: true });
//                 }
//                 App.publish('NotAuthenticated', [opts]);
//               } else console.warn(err);
//               App.loading.stop();
//             } else {
//               console.warn('Server connected. User authorized!');
//               App.user = user;
//               App.publish(reconnect ? 'DNodeReconnectUserAuthorized'
//                           : 'UserWasAuthenticated');
//             }
//           });
//         }
//       });
//     },

//     build: function () {
//       App.mainView = new App.views.MainView().render();
//       App.loading.stop();
//     },

//     Loader: function () {
//       var target = document.getElementById('loading');
//       return {
//         start: function () {
//           if (!App.spinner) {
//             App.spinner = new Spinner({
//               lines: 12,
//               length: 7,
//               width: 4,
//               radius: 40,
//               color: '#333',
//               speed: 1,
//               trail: 60,
//               shadow: false,
//             });
//           }
//           App.spinner.spin(target);
//           $(target).show();
//           return this;
//         },
//         stop: function () {
//           if (App.spinner)
//             App.spinner.stop();
//           $(target).hide();
//           return this;
//         },
//       }
//     },

//   };

//   domReady(function () {
//     App.loading = new App.Loader().start();
//     App.start();
//   });

// });

