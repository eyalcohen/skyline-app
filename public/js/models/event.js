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
        var verb, target, type, icon;
        if (att.data.target.t === 'comment') {
          var cowner =  att.data.action.i === att.data.target.i ?
              'their own':
              '<a href="/' + att.data.target.u + '" class="navigate">'
              + att.data.target.a + '\'s</a>';
          verb = 'replied to ' + cowner + ' comment on';
          target = att.data.target.p;
        } else {
          verb = 'commented on';
          target = att.data.target;
        }
        if (target.t === 'dataset') {
          type = 'data source';
          icon = target.l ? 'lock': 'database';
        } else {
          type = 'mashup';
          icon = target.l ? 'lock': 'folder-empty';
        }
        var owner = att.data.action.i === target.i ?
            'their own':
            '<a href="/' + target.u + '" class="navigate">'
            + target.a + '\'s</a>';
        var linkClass = 'navigate';
        if (target.l) linkClass += ' locked';
        var link = '<a href="/' + target.s + '" class="' + linkClass + '">';
        var gravatar = 'https://www.gravatar.com/avatar/'
            + att.data.action.g + '?s=16&d=mm';

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
          icon = att.data.target.l ? 'lock': 'database';
        } else {
          verb = 'created a new';
          type = 'mashup';
          icon = att.data.target.l ? 'lock': 'folder-empty';
        }
        var linkClass = 'navigate';
        if (att.data.target.l) linkClass += ' locked';
        var link = '<a href="/' + att.data.target.s + '" class="' + linkClass + '">';

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' a ' + type + '.'
            + '<span class="event-body event-body-big">'
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a></span>';

      } else if (att.data.action.t === 'fork') {
        var type, icon, picon;
        if (att.data.target.t === 'dataset') {
          type = 'data source';
          icon = att.data.target.l ? 'lock': 'database';
          picon = att.data.target.p.l ? 'lock': 'database';
        } else {
          type = 'mashup';
          icon = att.data.target.l ? 'lock': 'folder-empty';
          picon = att.data.target.p.l ? 'lock': 'folder-empty';
        }
        var verb = 'forked';
        var linkClass = 'navigate';
        if (att.data.target.l) linkClass += ' locked';
        var link = '<a href="/' + att.data.target.s + '" class="' + linkClass + '">';
        var plinkClass = 'navigate';
        if (att.data.target.p.l) plinkClass += ' locked';
        var plink = '<a href="/' + att.data.target.p.s + '" class="' + plinkClass + '">';
        var owner = att.data.action.i === att.data.target.p.i ?
            'their own':
            '<a href="/' + att.data.target.p.u + '" class="navigate">'
            + att.data.target.p.a + '\'s</a>';

        return '<a href="/' + att.data.action.u + '" class="navigate">'
            + att.data.action.a + '</a> '
            + verb + ' ' + owner + ' ' + type + ', '
            + plink + '<i class="icon-' + picon + '"></i>'
            + att.data.target.p.n + '</a>.'
            + '<span class="event-body event-body-big">'
            + link + '<i class="icon-' + icon + '"></i>'
            + att.data.target.n + '</a></span>';
      } else return '';
    }

  });
});
