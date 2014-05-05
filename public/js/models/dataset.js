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

      // Make ID a number.
      this.set('id', Number(this.id), {silent: true});

      // For forks (not currently used).
      var parent = this.get('parent');
      if (parent) {
        parent.id = Number(parent.id);
        this.set('parent', parent, {silent: true});
      }
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

    explain: function () {
      return ' added a <a href="/' + this.get('author').usename + '/'
          + this.id + '" class="title navigate">dataset</a>.';
    },

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d, yyyy');
    },

    body: function (full) {
      var txt = util.formatText(this.get('body'));
      return txt;
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    }

  });
});
