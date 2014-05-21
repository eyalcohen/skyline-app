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
  'text!../../templates/profile.header.html',
  'views/lists/events',
  'views/lists/datasets.sidebar',
  'views/lists/views.sidebar'
], function ($, _, Backbone, mps, util, User, template, header, Events, Datasets, Views) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
      this.subscriptions = [];
    },

    render: function () {

      // Use a model for the main content.
      this.model = new User(this.app.profile.content.page);

      // Set page title.
      this.app.title(this.model.get('displayName')
          + ' (@' + this.model.get('username') + ')',
          _.template(header).call(this), true);


      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Set page title
      var doctitle = 'Skyline | ' + this.model.get('displayName');
      doctitle += ' (@' + this.model.get('username') + ')';
      this.app.title(doctitle);

      // Render title.
      this.title = _.template(header).call(this);

      this.trigger('rendered');

      return this;
    },

    events: {},

    setup: function () {

      // Render lists.
      this.events = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'member',
        reverse: true
      });
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
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },
  });
});
