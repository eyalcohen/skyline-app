/*!
 * Copyright 2011 Mission Motors
 */

Backbone.sync = function(method, model, options) {
  var isCollection = model.hasChanged ? false : true,
  handleResponse = function(err, obj) {
    if (err) {
      App.publish('NotAuthenticated');
      options.error(obj);
    } else if ('string' === typeof obj) {
      try {
        obj = JSON.parse(obj);
      } catch(e) {}
    }
    options.success(obj);
    if (isCollection) {
      model.loaded();
    }
  };
  switch (method) {
    case 'create':
      //
    case 'read':
      App.api[model.readFunc].call(App.api, App.user, handleResponse);
    case 'update':
      //
  }
};

