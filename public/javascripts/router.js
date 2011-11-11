/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Router.extend({

    routes: {
      'vehicle/:id': 'vehicle',
    },

    vehicle: function (id) {
      console.log(id);
    },

  });
});

