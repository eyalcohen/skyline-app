/*
 * Event model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function () {
      var att = this.attributes;

      if (att.data.action.t === 'comment') {
        var verb = att.data.target.t === 'comment' ? 'replied to': 'commented on';
        var owner;

        if (att.data.action.i === att.data.target.i) {
          owner = 'their';
        } else if (att.subscriber_id === att.data.target.i)
          owner = 'your';
        else {
          owner = att.data.target.a + '\'s';
        }

        return '<a href="' + att.actor.username + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' ' + owner + ' '
            + '<a href="' + att.data.target.s + '" class="navigate">'
            + att.data.target.t + '</a>.'
            + (att.data.action.b ? '<span class="event-body">"'
            + att.data.action.b + '"</span>': '');
      
      } else if (att.data.action.t === 'dataset') {
        var verb = 'added';

        return att.data.action.a + ' '
            + verb + ' a '
            + att.data.action.b + ' of '
            + '' + att.data.target.n + ' at '
            + att.data.target.w
            + '.';
      
      } else return '';
    }

  });
});
