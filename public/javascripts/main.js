
/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */


// include dnode client scripts
window.DNode = require('dnode');

// load client-only modules
requirejs(['libs/store']);

window.App = {
  debug: true,
  start: function () {
    return DNode.connect(function (remote) {
      // remote.subscribe('data', function (n) {
      //   document.getElementById('output').innerHTML += n + ' ';
      // });
      var _ref;
      try {
        App.cache = store;
        App.cache.set('user', (_ref = window.sessionInfo) != null ? _ref : null);
        window.sessionInfo = null;
        
        if (!App.cache.get('user')) {

          // load login script
          requirejs(['login']);

        } else {

          // load server-client shared modules
          window._ = require('underscore');
          window.Backbone = require('backbone');

          var ps = require('./minpubsub');

          App.publish = ps.publish;
          App.subscribe = ps.subscribe;
          App.unsubscribe = ps.unsubscribe;

          console.log('Do something else.');

          // App.sampleCollection = new SampleCollection();
          // return App.sampleCollection.fetch();
        }
      } catch (_e) {}
    });
  },
  Views: {},
  Models: {},
  Controllers: {},
  Collections: {},
};

$(function () { return App.start(); });

// Backbone.sync = function(method, model, success, error) {
//   var collectionName, findFunct, handleResponse, isCollection;
//   isCollection = model.hasChanged != null ? false : true;
//   collectionName = isCollection ? new model.model().collectionName() : model.collectionName();
//   handleResponse = function(err, obj) {
//     if (err != null) {
//       if (err.message.indexOf("Unauthenticated") !== -1) {
//         App.publish("NotAuthenticated");
//       }
//       return error(err);
//     }
//     return success(obj);
//   };
//   switch (method) {
//     case "create":
//       return App.db.insert(App.user.toJSON(), collectionName, model.toJSON(), handleResponse);
//     case "read":
//       findFunct = isCollection ? App.db.find : App.db.findOne;
//       return findFunct.call(App.db, App.user.toJSON(), collectionName, {}, handleResponse);
//     case "update":
//       return App.db.update(App.user.toJSON(), collectionName, model.toJSON(), handleResponse);
//   }
// };


