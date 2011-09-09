/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (spec) {
      if ('function' === typeof spec)
        return false;
      // if (!spec || !spec.make || !spec.model || !spec.year) {
      //   throw new Error('InvalidConstructArgs');
      //   return;
      // }
      this.set({
        htmlId: 'notification_' + spec._id,
      });
      return this;
    }
  });
});

