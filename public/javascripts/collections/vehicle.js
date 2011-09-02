/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define(['models/vehicle'], function (model) {
  // define our collection
  return Backbone.Collection.extend({
    model: model,

    initialize: function () {
      // somthing
    }
  });
});

