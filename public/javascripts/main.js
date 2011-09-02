/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
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
      return DNode.connect({ reconnect: 500 }, function (remote) {
        // remote.subscribe('data', function (n) {
        //   document.getElementById('output').innerHTML += n + ' ';
        // });
        try {
          // server-client resources cooked into the app root
          var ps = require('./minpubsub');

          App.api = remote;
          App.cache = store;
          App.engine = require('jadeify');
          App.publish = ps.publish;
          App.subscribe = ps.subscribe;
          App.unsubscribe = ps.unsubscribe;
          // App.cache.remove('user');
          App.user = App.cache.get('user') || {};
          
          requirejs(['models', 'collections', 'views', 'backbone-sync'],
              function (models, collections, views) {
            App.models = models;
            App.collections = collections;
            App.views = views;
            if (_.isEmpty(App.user)) {
              App.loginView = new views.LoginView();
              App.loginView.render({ first: true });
              App.subscribe('UserWasAuthenticated', App.loadUser);
            } else {
              App.loadUser();
            }
          });
        } catch (_e) {}
      });
    },
    loadUser: function () {
      App.vehicleCollection = new App.collections.VehicleCollection();
      return App.vehicleCollection.fetch();
    }
  };
  return App.start();
});

