/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps'
], function ($, _, Backbone, mps) {
  return Backbone.View.extend({

    el: '.header',

    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

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
      mps.publish('user/signin/open');
    },

    avatar: function (e) {
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

    // save: function (e) {
    //   e.preventDefault();

    //   // Render the save view.
    //   mps.publish('view/save/open');
    // },

    logout: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });

      // Swap user header content.
      this.$('div.user-box').remove();
      $('<a id="signin" class="button">Sign in</a>').appendTo(this.$el);

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
