/*
 * Page view for splash.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/splash.html'
], function ($, _, Backbone, mps, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'splash',

    // Module entry point:
    initialize: function (app) {

      // Save app ref.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Attach a ref to 'update' to the window so it can be
      // reached by the iframe source.
      document.__update = _.bind(this.update, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Set page title
      this.app.title('');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.code = this.$('.code');
      this.label = this.$('.splash-embed-label');
      this.iframe = this.$('iframe');

      // Fill in the embed code.
      this.update(this.iframe.attr('src'));

      return this;
    },

    // Bind mouse events.
    events: {
      'click .splash-button': 'signin',
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
      this.remove();
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    },

    update: function (str) {
      this.code.html('<iframe width="100%" height="100%" '
          + 'src="' + str + '" frameborder="0"></iframe>');
      this.code.height('auto');
      var scrollHeight = this.code.get(0).scrollHeight;
      var padding = parseInt(this.code.css('padding-top'))
          + parseInt(this.code.css('padding-bottom'));
      this.code.height(scrollHeight - padding).focus().blur();
      this.label.css('line-height', scrollHeight + 'px');
      
    }

  });
});
