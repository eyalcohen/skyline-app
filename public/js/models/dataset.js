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
      this.set('id', Number(this.id), {silent: true});
    },

    formatTitle: function () {
      return this.get('title') || 'Untitled';
    },

    size: function () {
      return util.addCommas(Math.round(this.get('file').size / 1e3));
    },

    formatAuthorFor: function (user) {
      if (user && user.id === this.get('author').id) {
        return 'You';
      } else {
        return this.get('author').displayName;
      }
    },

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d, yyyy');
    },

    description: function () {
      var txt = this.get('description') ?
          util.formatText(this.get('description')): '';
      return txt;
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    }

  });
});
