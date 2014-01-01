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
        var verb, type, icon;
        var target;
        if (att.data.target.t === 'comment') {
          var cowner =  att.data.action.i === att.data.target.i ?
              'their own':
              '<a href="/' + att.data.target.u + '" class="navigate">'
              + att.data.target.a + '\'s</a>';
          verb = 'replied to ' + cowner + ' ' + ' comment on';
          target = att.data.target.p;
        } else {
          verb = 'commented on';
          target = att.data.target;
        }
        var owner = att.data.action.i === target.i ?
            'their own':
            '<a href="/' + target.u + '" class="navigate">'
            + target.a + '\'s</a>';
        var gravatar = 'https://www.gravatar.com/avatar/'
            + att.data.action.g + '?s=16&d=mm';
        var link = '<a href="/' + target.s + '" class="navigate">';
        if (target.t === 'dataset') {
          type = 'data source';
          icon = 'database';
        } else {
          type = 'mashup';
          icon = 'folder-empty';
        }

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
        if (att.data.target.t === 'dataset') {
          verb = 'added';
          type = 'data source';
          icon = 'database';
        } else {
          verb = 'created a new';
          type = 'mashup';
          icon = 'folder-empty';
        }
        var link = '<a href="/' + att.data.target.s + '" class="navigate">';

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' a ' + type + '.'
            + '<span class="event-body event-body-big">'
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a></span>';

      } else if (att.data.action.t === 'fork') {
        var type, icon;
        if (att.data.target.t === 'dataset') {
          type = 'data source';
          icon = 'database';
        } else {
          type = 'mashup';
          icon = 'folder-empty';
        }
        var verb = 'forked';
        var link = '<a href="/' + att.data.target.s + '" class="navigate">';
        var plink = '<a href="/' + att.data.target.p.s + '" class="navigate">';
        var owner = att.data.action.i === att.data.target.p.i ?
            'their own':
            '<a href="/' + att.data.target.p.u + '" class="navigate">'
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
