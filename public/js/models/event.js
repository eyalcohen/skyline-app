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
        var verb = 'commented on';
        var owner;

        if (att.data.action.i === att.data.target.i) {
          owner = 'their';
        } else if (att.subscriber_id === att.data.target.i)
          owner = 'your';
        else {
          owner = att.data.target.a + '\'s';
        }

        return '<strong>' + att.data.action.a + '</strong> '
            + verb + ' <strong>'
            + owner + '</strong> '
            + att.data.target.t
            + (att.data.target.n !== '' ? ' <strong>'
            + att.data.target.n + '</strong>': '')
            + ': "' + att.data.action.b
            + '".';
      
      } else if (att.data.action.t === 'dataset') {
        var verb = 'added';

        return '<strong>' + att.data.action.a + '</strong> '
            + verb + ' a <strong>'
            + att.data.action.b + '</strong> of '
            + '<strong>' + att.data.target.n + '</strong> at '
            + att.data.target.w
            + '.';
      
      } else return '';
    }

  });
});
