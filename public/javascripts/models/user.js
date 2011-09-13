/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args || !args.email || !args.name.first || !args.name.last) {
        throw new Error('InvalidConstructArgs');
        return;
      }
      this.set({
        htmlId: 'user_' + args._id,
      });
      return this;
    }
  });
});

