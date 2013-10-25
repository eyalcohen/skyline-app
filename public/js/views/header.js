/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'views/lists/flashes',
  'text!../../templates/box.html'
], function ($, _, Backbone, mps, Flashes, box) {
  return Backbone.View.extend({

    el: '.header',

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

      // Save refs.

      // Shell listeners / subscriptions.
      // Do this here intead of init ... re-renders often.
      if (this.app.profile && this.app.profile.user) {
        
        // For logout...
        this.subscriptions.push(mps.subscribe('user/delete',
            _.bind(this.logout, this)));
      }

      // Start block messages.
      if(!this.flashes)
        this.flashes = new Flashes(this.app);

      // For graph titles...
      this.subscriptions.push(mps.subscribe('title/set',
            _.bind(this.title, this)));
    },

    // Bind mouse events.
    events: {
      'click .signin-button': 'signin',
      'click .username': 'username',
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

    username: function (e) {
      e.preventDefault();

      // Route to profile.
      this.app.router.navigate('/' + this.app.profile.user.username,
          {trigger: true});
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
      this.$('.user-box').remove();
      $('<a class="signin-button button">Sign in</a>').prependTo(this.$el);
    },

    title: function (str) {
      this.$('.header-title').html(str);
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
