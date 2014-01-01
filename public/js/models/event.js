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
      console.log(att)

      if (att.data.action.t === 'comment') {
        var verb, type, icon, link, owner, link;
        var target;
        var gravatar = 'https://www.gravatar.com/avatar/'
            + att.data.action.g + '?s=16&d=mm';

        if (att.data.target.t === 'comment') {
          verb = 'replied to a comment on';
          link = '<a href="/' + att.data.target.p.s + '" class="navigate">';
          target = att.data.target.p;
        } else {
          verb = 'commented on';
          link = '<a href="/' + att.data.target.s + '" class="navigate">';
          target = att.data.target;
        }

        if (target.t === 'dataset') {
          type = 'data source';
          icon = 'database';
        } else {
          type = 'mashup';
          icon = 'folder-empty';
        }

        if (att.data.action.i === target.i)
          owner = 'their own';
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

      } else if (att.data.action.t === 'fork') {
        var verb = 'forked';
        var type, icon, owner;
        var link = '<a href="/' + att.data.target.s + '" class="navigate">';
        var plink = '<a href="/' + att.data.target.p.s + '" class="navigate">';
        if (att.data.target.t === 'dataset') {
          type = 'data source';
          icon = 'database';
        } else {
          type = 'mashup';
          icon = 'folder-empty';
        }

        if (att.data.action.i === att.data.target.p.i)
          owner = 'their own';
        else
          owner = '<a href="/' + att.data.target.p.u + '" class="navigate">'
              + att.data.target.p.a + '\'s</a>';

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' ' + owner + ' ' + type + ', '
            + plink + '<i class="icon-' + icon + '"></i>'
            + att.data.target.p.n + '</a>.'
            + '<span class="event-body event-body-big">'
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a></span>';
      } else return '';
    }

  });
});
