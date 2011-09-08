/*!
 * Copyright 2011 Mission Motors
 */

// include global server-client shared resources
window._ = require('underscore');
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
      DNode.connect({ disconnect: App.reconnect }, function (remote) {
        // remote.subscribe('data', function (n) {
        //   document.getElementById('output').innerHTML += n + ' ';
        // });
        try {
          // server-client resources cooked into the app root
          var ps = require('./minpubsub');

          App.api = remote;
          App.store = store;
          App.engine = require('jadeify');
          App.publish = ps.publish;
          App.subscribe = ps.subscribe;
          App.unsubscribe = ps.unsubscribe;

          App.regions = {
            header: $('header'),
            main: $('#main'),
            footer: $('footer'),
            menu: $('nav ul'),
            left: $('.dashboard-left'),
            right: $('.dashboard-right'),
          };

          App.user = App.store.get('user') || {};

          requirejs(['collections', 'views', 'router', 'backbone-sync'],
              function (collections, views, Router) {
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
              App.subscribe('UserWasAuthenticated', App.loadUser);
            } else {
              App.logout.render();
              App.loadUser();
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

    loadUser: function () {
      App.vehicleCollection = new App.collections.VehicleCollection();
      App.vehicleCollection.fetch();
    }

  };
  App.start();
});

