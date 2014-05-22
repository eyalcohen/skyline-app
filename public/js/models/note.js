/*
 * Note model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function () {
      return util.formatText(this.get('body'));
    },

    formatChannelName: function (str) {
      return _.str.prune(str, 30);
    }

  });
});
