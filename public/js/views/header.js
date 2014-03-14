/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'views/lists/choices',
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

      // Shell listeners / subscriptions.
      // Do this here intead of init ... re-renders often.
      if (this.app.profile && this.app.profile.user) {
        
        // For logout...
        this.subscriptions.push(mps.subscribe('user/delete',
            _.bind(this.logout, this)));
      }

      // For graph titles...
      this.subscriptions.push(mps.subscribe('title/set',
          _.bind(this.title, this)));

      // Start search choices.
      if(!this.choices)
        this.choices = new Choices(this.app, {
          reverse: true,
          el: '.header-search',
          placeholder: 'Search for something...',
          route: true,
          types: ['users', 'views', 'datasets']
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

    follow: function (e) {
      var btn = $(e.target);

      // Prevent multiple requests.
      if (this.working) return false;
      this.working = true;

      // Do the API request.
      var username = this.app.profile.content.page.username;
      rest.post('/api/users/' + username + '/follow', {},
          _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Update button content.
        btn.removeClass('follow-button').addClass('unfollow-button')
            .html('<i class="icon-user-delete"></i> Unfollow');

      }, this));

      return false;  
    },

    unfollow: function (e) {
      var btn = $(e.target);

      // Prevent multiple requests.
      if (this.working) return false;
      this.working = true;

      // Do the API request.
      var username = this.app.profile.content.page.username;
      rest.post('/api/users/' + username + '/unfollow', {},
          _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Update button content.
        btn.removeClass('unfollow-button').addClass('follow-button')
            .html('<i class="icon-user-add"></i> Follow');

      }, this));

      return false;  
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    },

    add: function (e) {
      e.preventDefault();

      // Render the browser view.
      mps.publish('modal/browser/open');
    },

    logout: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });

      // Swap user header content.
      this.$('.header-user-box').remove();
      $('<a class="button signin-button">Sign in</a>').prependTo(this.$el);
    },

    title: function (str) {
      this.$('.page-header').html(str);
    },

    normalize: function () {
      this.$el.addClass('normal');
    },

    unnormalize: function () {
      this.$el.removeClass('normal');
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
        this.$('.header-user-menu').addClass('hide');
        _.delay(_.bind(function () {
          this.$('.header-user-menu').removeClass('hide');
        }, this), 500);
      }
    },

  });
});
