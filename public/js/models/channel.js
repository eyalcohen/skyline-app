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
      this.set('id', this.get('channelName'), {silent: true});
      this.set('lineStyleOptions', {});
    },

    name: function () {
      return this.get('humanName');
    },

  });
});
