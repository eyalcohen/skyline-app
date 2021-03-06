/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'views/lists/search.choices',
  'text!../../templates/box.html'
], function ($, _, Backbone, mps, rest, Choices, box) {
  return Backbone.View.extend({

    el: '.header',
    working: false,

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
    },

    render: function (login) {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      // Check if user just logged in.
      if (login && this.app.profile.user) {
        this.$('.signin-button').remove();
        $(_.template(box).call(this)).prependTo(this.$el);
      }

      this.setup();
      return this;
    },

    setup: function () {
      this.delegateEvents();

      // Start search choices.
      if(!this.choices) {
        this.choices = new Choices(this.app, {
          reverse: true,
          el: '.header-search',
          placeholder: 'Search for datasets, channels and more...',
          route: true,
          choose: true,
          types: ['users', 'views', 'datasets', 'channels']
        });
      }
    },

    events: {
      'click .header-logo': 'home',
      'click .follow-button': 'follow',
      'click .unfollow-button': 'unfollow',
      'click .add-data-button': 'add',
      'click .navigate': 'navigate'
    },

    add: function (e) {
      e.preventDefault();
      mps.publish('modal/finder/open');
    },

    home: function (e) {
      e.preventDefault();
      this.navigate(null, '/');
    },

    navigate: function (e, path) {
      if (e) {
        e.preventDefault();
      }
      path = path || $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
        this.$('.header-user').addClass('blur');
        _.delay(_.bind(function () {
          this.$('.header-user').removeClass('blur');
        }, this), 500);
      }
    },

    highlight: function (href) {
      this.$('.header-navigation a').removeClass('active');
      this.$('.header-navigation a[href="' + href + '"]').addClass('active');
    }

  });
});
