/*
 * View model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.set('id', Number(this.id), {silent: true});

      var channels = [];
      _.each(this.get('datasets'), function (d) {
        _.each(d.channels, function (c) {
          channels.push(c);
        });
      });
      this.set('channels', channels, {silent: true});
      this.set('channels_cnt', channels.length, {silent: true});

      // For forks (not currently used).
      // var parent = this.get('parent');
      // if (parent) {
      //   parent.id = Number(parent.id);
      //   this.set('parent', parent, {silent: true});
      // }
    },

    formatTitle: function () {
      return this.get('name') || 'Untitled';
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
    },

  });
});
