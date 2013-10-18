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

    name: function () {
      return _.str.strLeft(this.get('val').channelName, '__');
    },

  });
});
