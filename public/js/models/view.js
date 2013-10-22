/*
 * View model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    countDatasets: function () {
      return _.size(this.get('datasets'));
    },

    countChannels: function () {
      var cnt = 0;
      _.each(this.get('datasets'), function (d) {
        cnt += d.channels ? _.size(d.channels): 0;
      });
      return cnt;
    },

  });
});
