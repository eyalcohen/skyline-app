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
      this.set('offset', Number(0))
      this.set('beg', Number(0))
      this.set('end', Number(0))
    },

    size: function () {
      return util.addCommas(Math.round(this.get('file').size / 1e3));
    }

  });
});
