/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if ('function' === typeof args)
        return false;
      // By including a reference to collection, the jade stuff ends up
      // traversing a large amount of unnecessary crud, taking a long time
      // (2+ seconds!) to generate the notifications list.  We don't need
      // the reference, so get rid of it.
      delete this.collection;

      this.set({
        htmlId: 'vehicle_' + args._id,
      });

      return this;
    }
  });
});

