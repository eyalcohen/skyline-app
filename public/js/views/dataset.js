/*
 * Page view for a dataset.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/dataset',
  'text!../../templates/dataset.html',
  'text!../../templates/dataset.header.html'
], function ($, _, Backbone, mps, util, Dataset, template, header) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
      this.subscriptions = [];
    },

    render: function () {
      this.model = new Dataset(this.app.profile.content.page);

      // Set page title.
      this.app.title('Skyline | ' + this.model.get('title'));

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Render title.
      this.title = _.template(header).call(this);

      this.trigger('rendered');
      return this;
    },

    events: {},

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
  });
});
