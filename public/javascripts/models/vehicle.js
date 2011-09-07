/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define(function () {
  return Backbone.Model.extend({
    // validate: function (attrs) {
    //   if (attrs.title) {
    //     if (!_.isString(attrs.title) || attrs.title.length === 0 ) {
    //       return "Title must be a string with a length";
    //     }
    //   }
    // },

    initialize: function (spec) {
      if ('function' === typeof spec)
        return;

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
    }
  });
});

