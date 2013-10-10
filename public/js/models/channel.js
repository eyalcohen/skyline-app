/*
 * Channel model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {

      // Use name as id.
      this.set('id', this.get('val').channelName, {silent: true});
    },

    title: function () {
      var tmp = _.str.strLeft(this.get('val').channelName, '__');
      return tmp.length <= 20 ? tmp: tmp.substr(0, 20) + '...';
    },

  });
});
