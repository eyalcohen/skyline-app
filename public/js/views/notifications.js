/*
 * Page view for all notifications.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/notifications.html',
  'views/lists/notifications',
  'views/lists/datasets.sidebar',
  'views/lists/views.sidebar'
], function ($, _, Backbone, mps, util, template, Notifications, Datasets, Views) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
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
      this.notifications = new Notifications(this.app, {parentView: this, reverse: true});
      this.datasets = new Datasets(this.app, {parentView: this, reverse: true});
      this.views = new Views(this.app, {parentView: this, reverse: true});

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
      this.notifications.destroy();
      this.datasets.destroy();
      this.views.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    title: function () {
      this.app.title('Skyline | ' + this.app.profile.user.displayName
          + ' - Notifications');
    }

  });
});
