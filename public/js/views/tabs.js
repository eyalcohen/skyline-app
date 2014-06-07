/*
 * Page view for the about page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'util',
  'mps',
  'rest',
  'text!../../templates/tabs.html'
], function ($, _, Backbone, util, mps, rest, template) {

  return Backbone.View.extend({

    el: '.tabs',
    working: false,

    // Module entry point.
    initialize: function (app, params) {
      this.app = app;
      this.params = params || {};

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];

      // Socket Subscriptions
      this.app.rpc.socket.on('notification.new', _.bind(function (data) {
        if (this.app.profile.notifications !== undefined) {
          ++this.app.profile.notifications;
          this.updateNotificationsCount();
        }
      }, this));
      this.app.rpc.socket.on('notification.read', _.bind(function (data) {
        if (this.app.profile.notifications !== undefined) {
          --this.app.profile.notifications;
          this.updateNotificationsCount();
        }
      }, this));
    },

    render: function () {
      if (!this.params.tabs) {
        this.params.tabs = [];
      }

      // Render or activate tabs.
      if (!this.params.tabs || this.params.tabs.length === 0) {
        this.empty();
      }
      var tabs = this.$('.tab');
      if (tabs.length === 0) {
        this.template = _.template(template);
        this.$el.html(this.template.call(this));
      } else {
        var i = -1;
        _.find(this.params.tabs, function (t) {
          ++i;
          return t.active;
        });
        tabs.removeClass('active');
        this.$('.tab:eq(' + i + ')').addClass('active');
      }

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .follow-button': 'follow',
      'click .unfollow-button': 'unfollow',
      'click .watch-button': 'watch',
      'click .unwatch-button': 'unwatch'
    },

    setup: function () {

      // Update notifications count.
      this.updateNotificationsCount();

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
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    follow: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        if (data.following === 'request')
          btn.removeClass('follow-button').addClass('disabled')
              .html('<i class="icon-user"></i> Requested');
        else
          btn.removeClass('follow-button').addClass('unfollow-button')
              .html('<i class="icon-user-delete"></i> Unfollow');
      });

      return false;
    },

    unfollow: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('unfollow-button').addClass('follow-button')
            .html('<i class="icon-user-add"></i> Follow');
      });

      return false;
    },

    watch: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('watch-button').addClass('unwatch-button')
            .html('<i class="icon-eye-off"></i> Unwatch');
      });

      return false;
    },

    unwatch: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('unwatch-button').addClass('watch-button')
            .html('<i class="icon-eye"></i> Watch');
      });

      return false;
    },

    request: function (target, cb) {

      // Prevent multiple requests.
      if (this.working || !this.app.profile.content.page) return false;
      this.working = true;

      // Make request.
      var path = target.data('path');
      rest.post(path, {}, _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error', sticky: true}]);
          return false;
        }

        // Swap paths.
        if (data.following === 'request') {
          target.data('path', '').data('_path', '');
        } else {
          target.data('path', target.data('_path'));
          target.data('_path', path);
        }

        cb(data);
      }, this));

      return false;
    },

    updateNotificationsCount: function () {
      if (!this.app.profile || this.app.profile.notifications === undefined) {
        return;
      }
      if (this.app.profile.notifications > 0) {
        this.$('.tab-count').text(this.app.profile.notifications).show();
      } else {
        this.$('.tab-count').text('').hide();
      }
    },

    setTitle: function(str, params) {
      var sel = $('.title-left');
      if (str) {
        sel.text(str);
        if (params && params.center) {
          sel.css({width: '100%', margin: 0, 'text-align': 'center'});
        }
      }
    }

  });
});
  
