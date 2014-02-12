/*
 * Page view for profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/user',
  'text!../../templates/profile.html',
  'views/lists/profile.datasets',
  'views/lists/profile.views'
], function ($, _, Backbone, mps, util, User, template, Datasets, Views) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'profile',

    // Module entry point:
    initialize: function (app) {

      // Save app ref.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new User(this.app.profile.content.page);

      // Set page title
      var gravatar = '<img src="https://www.gravatar.com/avatar/'
          + this.model.get('gravatar') + '?s=60&d=mm" width="60" height="60" />';
      var title = '<span class="page-header-profile-title">'
          + gravatar + '<a href="/' + this.model.get('username')
          + '" class="navigate page-header-username">'
          + this.model.get('username')
          + ' (' + this.model.get('displayName') + ')</a>';
      title += '</span>';
      this.app.title(this.model.get('username')
          + ' (' + this.model.get('displayName') + ')', title, true);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Render lists.
      this.datasets = new Datasets(this.app, {
        datasets: this.app.profile.content.datasets,
        parentView: this,
        reverse: true
      });
      this.views = new Views(this.app, {
        views: this.app.profile.content.views,
        parentView: this, 
        reverse: true
      });

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
      this.undelegateEvents();
      this.stopListening();
      this.datasets.destroy();
      this.views.destroy();
      this.remove();
    },

  });
});
