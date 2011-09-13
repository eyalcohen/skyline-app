/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args || !args.make || !args.model || !args.year) {
        throw new Error('InvalidConstructArgs');
        return;
      }
      this.set({
        htmlId: 'vehicle_' + args._id,
      });
      return this;
    }
  });
});

