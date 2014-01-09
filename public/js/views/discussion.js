/*
 * Discussion modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/discussion.html',
  'views/lists/replies'
], function ($, _, Backbone, mps, rest, util, Spin, template, Replies) {

  return Backbone.View.extend({
    
    // The DOM target element for this page.
    className: 'discussion',
    
    // Module entry point.
    initialize: function (app, options) {
      
      // Save app reference.
      this.app = app;
      this.options = options;
      this.model = this.options.model;

      // Client-wide subscriptions
      this.subscriptions = [];

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Do the timer.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // Get replies.
      rest.get('/api/comments/' + this.model.id, {},
          _.bind(function (err, data) {
        if (err) return console.log(err);

        // Set comments on model.
        this.model.set(data);

        // Render replies.
        this.replies = new Replies(this.app, {parentView: this});

        // Resize modal.
        $.fancybox.reposition(null, null, true);

      }, this));

      return this;
    },

    when: function () {
      if (!this.time)
        this.time = this.$('time.created:first');
      this.time.text(util.getRelativeTime(this.model.get('updated')
          || this.model.get('created')));
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
      if (this.timer)
        clearInterval(this.timer);
      this.replies.destroy();
      this.empty();
    },

  });
});
