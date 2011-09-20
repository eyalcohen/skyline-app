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
    'libs/store.min'],
    function () {
  window.App = {
    debug: true,
    start: function () {
      DNode().connect({ disconnect: App.reconnect }, function (remote) {
        // remote.subscribe('data', function (n) {
        //   document.getElementById('output').innerHTML += n + ' ';
        // });
        try {
          App.api = remote;
          App.store = store;
          App.engine = require('jadeify');
          App.publish = require('./minpubsub').publish;
          App.subscribe = require('./minpubsub').subscribe;
          App.unsubscribe = require('./minpubsub').unsubscribe;
          App.shared = require('./shared_utils');

          App.user = App.store.get('user') || {};

          requirejs(['models', 'collections', 'views',
              'router', 'backbone-sync', 'backbone-super', 'interface'],
              function (models, collections, views, Router) {
            App.models = models;
            App.collections = collections;
            App.views = views;
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
            App.router = new Router();
            Backbone.history.start({
              pushState: true,
              silent: true,
            });
            // SP: This will set the URL, but we must ensure
            // the server can provide the same route if 
            // asked directly.
            //// App.router.navigate('somewhere');
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
          console.warn('Server reconnected.');
        });
      }, 500);
    },

    buildDash: function () {
      $('.tabs, .folder').show();
      App.notificationCollection =
          new App.collections.NotificationCollection();
      App.notificationCollection.fetch();
      App.vehicleCollection =
          new App.collections.VehicleCollection();
      App.vehicleCollection.fetch();
      // TODO: check if user is ADMIN first!
      App.userCollection =
          new App.collections.UserCollection().fetch();
    }

  };
  requirejs.ready(App.start());
});

