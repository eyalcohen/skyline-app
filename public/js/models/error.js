/*
 * Error model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.id = util.uid(5);
      this.set('message', _.str.titleize(this.get('message') || 'Server Error'));
      this.set('code', this.get('code') ? '(' + this.get('code') + ')': '');
      this.set('stack', !window.__s && this.get('stack') ? this.get('stack'):
          ':( Looks like something went wrong. We track these errors automatically, but if the problem persists feel free to <a href="mailto:support@skyline-data.com">contact us</a>. In the meantime, try refreshing.');
    },

  });
});
