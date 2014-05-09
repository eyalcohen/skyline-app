/*
 * Notification model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function () {
      var att = this.attributes;

      if (att.event.data.action.t === 'note') {
        var verb = 'wrote a note on';
        var owner;
        if (att.event.data.action.i === att.event.data.target.i) {
          owner = 'their';
          verb = 'also ' + verb;
        } else if (att.subscriber_id === att.event.data.target.i) {
          owner = 'your';
        } else {
          owner = att.event.data.target.a + '\'s';
          verb = 'also ' + verb;
        }
        return '<strong>' + att.event.data.action.a + '</strong> '
            + verb + ' <strong>'
            + owner + '</strong> '
            + att.event.data.target.t
            + (att.event.data.target.n !== '' ? ' <strong>'
            + att.event.data.target.n + '</strong>': '')
            + ': "' + att.event.data.action.b
            + '".';

      } else if (att.event.data.action.t === 'comment') {
        var verb, target;
        if (att.event.data.target.t === 'note') {
          var cowner = att.subscriber_id === att.event.data.target.i ? 'your':
              (att.event.data.action.i === att.event.data.target.i ? 'their':
              att.event.data.target.a + '\'s');
          verb = 'replied to ' + cowner + ' note on';
          target = att.event.data.target.p;
        } else {
          verb = 'commented on';
          target = att.event.data.target;
        }
        var owner;
        if (att.event.data.action.i === target.i) {
          owner = 'their';
          verb = 'also ' + verb;
        } else if (att.subscriber_id === target.i) {
          owner = 'your';
        } else {
          owner = target.a + '\'s';
          verb = 'also ' + verb;
        }
        return '<strong>' + att.event.data.action.a + '</strong> '
            + verb + ' <strong>'
            + owner + '</strong> '
            + target.t
            + (target.n !== '' ? ' <strong>'
            + target.n + '</strong>': '')
            + ': "' + att.event.data.action.b
            + '".';

      } else if (att.event.data.action.t === 'request') {
        return '<strong>' + att.event.data.action.a + '</strong> '
            + 'wants to follow you.';

      } else if (att.event.data.action.t === 'accept') {
        return 'You are now following <strong>'
            + att.event.data.action.a + '</strong>';

      } else if (att.event.data.action.t === 'follow') {
        return '<strong>' + att.event.data.action.a + '</strong> '
            + 'is now following you.';

      } else return '';
    }

  });
});
