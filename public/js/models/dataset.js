/*
 * Dataset model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/datasets',

    size: function () {
      return util.addCommas(Math.round(this.get('file').size / 1e3));
    }

  });
});
