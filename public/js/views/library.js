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
  'text!../../templates/profile.header.html',
  'views/lists/datasets.library'
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
      this.$el.html(this.template.call(this));

      // Render title.
      this.title = _.template(header).call(this);

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Render lists.
      this.datasets = new Datasets(this.app, {parentView: this, reverse: true});

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
      this.datasets.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});
