/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

Backbone.sync = function(method, model, success, error) {
  var collectionName, findFunct, handleResponse, isCollection;
  isCollection = model.hasChanged != null ? false : true;
  // collectionName = isCollection ? new model.model().collectionName() : model.collectionName();
  handleResponse = function(err, obj) {
    console.log(err, obj);
    // if (err != null) {
    //   if (err.message.indexOf("Unauthenticated") !== -1) {
    //     App.publish("NotAuthenticated");
    //   }
    //   return error(err);
    // }
    // return success(obj);
  };
  switch (method) {
    case "create":
      return App.db.insert(App.user.toJSON(), collectionName, model.toJSON(), handleResponse);
    case "read":
      // findFunct = isCollection ? App.api.find : App.api.findOne;
      return App.api.fetchVehicles.call(App.api, App.user, handleResponse);
    case "update":
      return App.db.update(App.user.toJSON(), collectionName, model.toJSON(), handleResponse);
  }
};

