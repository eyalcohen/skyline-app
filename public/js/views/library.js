/*
 * Page view for all library datasets.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/library.html',
  'views/lists/datasets.library'
], function ($, _, Backbone, mps, util, template, Datasets) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {

      // Set page title
      this.app.title('Timeline | Library');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

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
