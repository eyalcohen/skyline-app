/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if ('function' === typeof args)
        return false;
      // if (!args || !args.email || !args.name.first || !args.name.last) {
      //   throw new Error('InvalidConstructArgs');
      //   return;
      // }

      delete this.collection;

      this.set({
        htmlId: 'user_' + args._id,
      });
      return this;
    }
  });
});

