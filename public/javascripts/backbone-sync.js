/*!
 * Copyright 2011 Mission Motors
 */

Backbone.sync = function(method, model, options) {
  var handleResponse = function(err, obj) {
    if (err) {
      if (err.message.indexOf("Unauthenticated") !== -1) {
        App.publish("NotAuthenticated");
      }
      return model.loaded(err);
    }
    if ('string' === typeof obj) {
      try {
        obj = JSON.parse(obj);
      } catch(e) {}
    }
    return model.loaded(null, obj);
  };
  switch (method) {
    case "create":
      //
    case "read":
      return App.api[model.readFunc].call(App.api, App.user, handleResponse);
    case "update":
      //
  }
};

