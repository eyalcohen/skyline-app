/*
 * Page view for a static page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'views/lists/home.datasets',
  'views/lists/home.views'
], function ($, _, Backbone, mps, util, Datasets, Views) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'static',

    // Module entry point:
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Set page title.
      this.app.title(this.options.title);

      // UnderscoreJS rendering.
      this.template = _.template(this.options.template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
    },

    // Misc. setup.
    setup: function () {

      // Render lists.
      this.datasets = new Datasets(this.app, {parentView: this, reverse: true});
      this.views = new Views(this.app, {parentView: this, reverse: true});

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.datasets.destroy();
      this.views.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});
