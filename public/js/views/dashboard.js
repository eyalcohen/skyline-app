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
  'views/lists/events',
  'views/lists/datasets.sidebar',
  'views/lists/views.sidebar'
], function ($, _, Backbone, mps, util, template, Events, Datasets, Views) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {

      // Set page title
      this.title();

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Render lists.
      this.events = new Events(this.app, {parentView: this, reverse: true});
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
      this.events.destroy();
      this.datasets.destroy();
      this.views.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    title: function () {
      this.app.title('Skyline | ' + this.app.profile.user.displayName
          + ' - Home');
    }

  });
});
