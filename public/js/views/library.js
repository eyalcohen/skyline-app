/*
 * Page view for all library datasets.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/user',
  'text!../../templates/library.html',
  'text!../../templates/profile.header.html'
], function ($, _, Backbone, mps, util, User, template, header, Datasets) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new User(this.app.profile.content.page);

      // Set page title
      this.app.title('Skyline | Library');

      this.template = _.template(template);
      this.$el.html(this.template.call(this, {datasets: this.app.profile.content.datasets}));

      // Render title.
      this.title = _.template(header).call(this);

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    setup: function () {
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
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
