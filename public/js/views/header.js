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

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions
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

        // UnderscoreJS rendering.
        $(_.template(box).call(this)).prependTo(this.$el);
      }

      // Done rendering ... trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Shell event.
      this.delegateEvents();

      // Start search choices.
      if(!this.choices)
        this.choices = new Choices(this.app, {
          reverse: true,
          el: '.header-search',
          placeholder: 'Search for something...',
          route: true,
          choose: true,
          types: ['users', 'views', 'datasets', 'channels']
        });
    },

    // Bind mouse events.
    events: {
      'click .header-logo': 'home',
      'click .follow-button': 'follow',
      'click .unfollow-button': 'unfollow',
      'click .signin-button': 'signin',
      'click .add-data-button': 'add',
      'click .navigate': 'navigate'
    },

    home: function (e) {
      e.preventDefault();

      // Route to home.
      this.app.router.navigate('/', {trigger: true});
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    },

    add: function (e) {
      e.preventDefault();

      // Render the finder view.
      mps.publish('modal/finder/open');
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
        this.$('.header-user').addClass('blur');
        _.delay(_.bind(function () {
          this.$('.header-user').removeClass('blur');
        }, this), 500);
      }
    },

  });
});
