/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define(function () {
  return Backbone.Model.extend({
    validate: function (attrs) {
      if (attrs.title) {
        if (!_.isString(attrs.title) || attrs.title.length === 0 ) {
          return "Title must be a string with a length";
        }
      }
    },
    initialize: function (spec) {
      // if (!spec || !spec.title || !spec.format) {
      //   throw "InvalidConstructArgs";
      // }
      this.set({
        htmlId: 'vehicle_' + this.cid
      });
    }
  });
});

