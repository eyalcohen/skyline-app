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

    el: '#header',

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
      'click #logo': 'home',
      'click #signin': 'signin',
      'click #header_avatar': 'avatar',
      'click #settings': 'settings'
    },

    widen: function () {
      this.$el.addClass('wide');
    },

    unwiden: function () {
      this.$el.removeClass('wide');
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

    settings: function (e) {
      e.preventDefault();

      // Route to settings.
      this.app.router.navigate('/settings', {trigger: true});
    },

    logout: function () {

      // Swap user header content.
      this.$('div.user-box').remove();
      $('<a id="signin" class="button">Sign in</a>').appendTo(this.$el);

    },

    title: function (str) {
      console.log(str)
      this.$('.header-title').html(str);
    }

  });
});
