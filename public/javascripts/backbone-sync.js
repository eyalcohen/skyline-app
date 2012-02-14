/*!
 * Copyright 2011 Mission Motors
 */

Backbone.sync = function(method, model, options) {
  var isCollection = model.hasChanged ? false : true,
  handleResponse = function(err, obj) {
    if (err) {
      if ('Permission denied.' === err) {
        App.user = null;
        $.get('/logout');
        App.publish('NotAuthenticated', [{
          first: true,
          report: 'Permission denied. Please sign in again.',
          type: 'error',
        }]);
      }
      options.error(obj);
      return;
    }
    options.success(obj);
    if (isCollection) model.loaded();
  };
  switch (method) {
    case 'read':
      if (model.readOpts != null)
        App.api[model.readFunc].call(App.api, model.readOpts, handleResponse);
      else
        App.api[model.readFunc].call(App.api, handleResponse);
      break;
  }
};

