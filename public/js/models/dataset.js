/*
 * Dataset model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    colors: [
      "#27CDD6",  // Dark cyan
      "#7A7A7A",  // Gray
      "#cb4b4b",  // Dark red
      "#76D676",  // Light green
      "#B2B848",  // Dark yellow
      "#8171E3",  // Violet
      "#47A890",  // Dark teal
      "#E8913F",  // Orange
      "#118CED",  // Dark blue
      "#28A128",  // Dark green
      "#FFA6A6",  // Pink
      "#96BDFF",  // Light blue
      "#D373FF",  // Light purple
    ],

    color: function () {
      return this.colors[this.collection.indexOf(this)];
    },

    size: function () {
      return util.addCommas(Math.round(this.get('file').size / 1e3));
    }

  });
});
