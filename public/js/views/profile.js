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
  'views/lists/views.sidebar',
  'views/lists/views.other.sidebar',
  'views/lists/followers',
  'views/lists/followees'
], function ($, _, Backbone, mps, util, User, template, header, Events, Datasets, Views,
      Others, Followers, Followees) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
      this.subscriptions = [];
    },

    render: function () {
      this.model = new User(this.app.profile.content.page);

      // Set page title.
      this.app.title('Skyline | ' + this.model.get('displayName')
          + ' (@' + this.model.get('username') + ')');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

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
      this.others = new Others(this.app, {parentView: this, reverse: true});
      this.followers = new Followers(this.app, {parentView: this, reverse: true});
      this.followees = new Followees(this.app, {parentView: this, reverse: true});

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
      this.others.destroy();
      this.followers.destroy();
      this.followees.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },
  });
});
