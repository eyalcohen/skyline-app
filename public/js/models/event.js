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
        var verb = att.data.target.t === 'comment' ?
            'replied to a comment on': 'commented on';
        var type, icon, link, owner;
        var gravatar = 'https://www.gravatar.com/avatar/'
            + att.data.action.g + '?s=16&d=mm';
        var link = '<a href="/' + att.data.target.s + '" class="navigate">';

        if (att.data.target.t === 'dataset') {
          type = 'data source';
          icon = 'database';
        } else {
          type = 'mashup';
          icon = 'folder-empty';
        }

        if (att.data.action.i === att.data.target.i)
          owner = 'their';
        else if (att.subscriber_id === att.data.target.i)
          owner = 'your';
        else
          owner = '<a href="/' + att.data.target.u + '" class="navigate">'
              + att.data.target.a + '\'s</a>';

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' ' + owner + ' ' + type + ', '
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a>.'
            + (att.data.action.b ? '<span class="event-body">"'
            + '<img src=' + gravatar + ' width="16" height="16" />'
            + att.data.action.b + '"</span>': '');

      } else if (att.data.action.t === 'create') {
        var verb, type, icon;
        var link = '<a href="/' + att.data.target.s + '" class="navigate">';
        if (att.data.target.t === 'dataset') {
          verb = 'added';
          type = 'data source';
          icon = 'database';
        } else {
          verb = 'created a new';
          type = 'mashup';
          icon = 'folder-empty';
        }

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' a ' + type + '.'
            + '<span class="event-body event-body-big">'
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a></span>';

      } else return '';
    }

  });
});
