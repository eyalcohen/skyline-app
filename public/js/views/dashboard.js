/*
 * Page view for all activity.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/dashboard.html',
  'views/lists/events'
], function ($, _, Backbone, mps, util, template, Events) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function () {

      // Set page title
      this.title();

      // Content rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Render lists.
      this.events = new Events(this.app, {
        parentView: this,
        reverse: true
      });

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.events.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    title: function () {
      this.app.title(this.app.profile.user.displayName + ' - Home');
    }

  });
});
