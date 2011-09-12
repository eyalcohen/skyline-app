/*!
 * Copyright 2011 Mission Motors
 */

// include global server-client shared resources
window._ = require('underscore');
window.Step = require('step');
window.DNode = require('dnode');

// include client deps and build app root
requirejs(['jquery',
    'libs/json2',
    'libs/modernizr-1.7.min',
    'libs/backbone-min',
    'libs/store.min'],
    function ($) {
  window.App = {
    debug: true,
    start: function () {
      DNode.connect({ disconnect: App.reconnect }, function (remote) {
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

          App.regions = {
            header: $('header'),
            main: $('#main'),
            footer: $('footer'),
            menu: $('nav ul'),
            top: $('.dashboard-top'),
            left: $('.dashboard-left'),
            right: $('.dashboard-right'),
          };

          App.user = App.store.get('user') || {};

          requirejs(['models', 'collections', 'views',
              'router', 'backbone-sync'],
              function (models, collections, views, Router) {
            App.models = models;
            App.collections = collections;
            App.views = views;
            App.login = new views.LoginView();
            App.logout = new views.LogoutView();
            if (_.isEmpty(App.user)) {
              App.login.render({
                first: true,
                report: 'Please log in.',
                type: 'message',
              });
              App.subscribe('UserWasAuthenticated', App.buildDash);
            } else {
              App.logout.render();
              App.buildDash();
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
        } catch (_e) {}
      });
    },

    reconnect: function () {
      console.warn('The server went away. Trying to reconnect ...');
      var reconnecter = setInterval(function () {
        DNode.connect({ disconnect: App.reconnect }, function (remote) {
          App.api = remote;
          clearInterval(reconnecter);
          console.warn('Server reconnected.');
        });
      }, 500);
    },

    buildDash: function () {
      App.notificationCollection =
          new App.collections.NotificationCollection();
      App.notificationCollection.fetch();
      App.vehicleCollection =
          new App.collections.VehicleCollection();
      App.vehicleCollection.fetch();
      App.mapModel = new App.models.MapModel();
      App.graphModel = new App.models.GraphModel();
    }

  };
  App.start();
});

