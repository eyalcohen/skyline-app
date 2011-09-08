/*!
 * Copyright 2011 Mission Motors2
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (spec) {
      if ('function' === typeof spec)
        return false;
      if (!spec || !spec.make || !spec.model || !spec.year) {
        throw "InvalidConstructArgs";
        return;
      }
      this.set({
        make: spec.make,
        model: spec.model,
        year: spec.year,
        htmlId: 'vehicle_' + spec._id,
      });
      return this;
    }
  });
});

