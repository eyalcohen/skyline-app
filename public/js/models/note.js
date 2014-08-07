/*
 * Note model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function (withAuthor) {
      if (withAuthor) {
        var name = '<a href="/' + this.get('author').username
            + '" class="event-comment-author navigate">'
            + this.get('author').displayName + '</a> ';
        return util.formatText(name + this.get('body'));
      } else {
        return util.formatText(this.get('body'));
      }
    },

    formatAuthorFor: function (user) {
      if (user && user.id === this.get('author').id) {
        return 'You';
      } else {
        return this.get('author').displayName;
      }
    },

    formatChannelName: function (str) {
      return _.str.prune(str, 30);
    }

  });
});
