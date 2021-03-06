/*
 * Flash model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.id = util.uid(5);
      if (_.isString(this.get('err'))) {
        this.set('err', {message: this.get('err')});
      }
    },

  });
});
