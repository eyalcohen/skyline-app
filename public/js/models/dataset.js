/*
 * Dataset model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {

      // Make ID a number;
      this.set('id', Number(this.id), {silent: true});
    },

    size: function () {
      return util.addCommas(Math.round(this.get('file').size / 1e3));
    }

  });
});
