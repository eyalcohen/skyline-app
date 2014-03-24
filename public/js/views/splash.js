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
      document.__update = _.bind(this.updateCodes, this);
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
      this.embedCode = this.$('.embed-code .code');
      this.iframe = this.$('iframe');

      // Fill in the codes.
      this.updateCodes({embed: this.iframe.attr('src').toLowerCase()});

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

    updateCodes: function (data) {

      // Embed
      if (this.iframe.length > 0) this.iframe.attr('src', data.embed);
      this.embedCode.html('<iframe width="100%" height="100%" '
          + 'src="' + data.embed + '" frameborder="0"></iframe>');
      this.positionLabelForCode(this.embedCode);
    },

    positionLabelForCode: function (code) {
      var scrollHeight = code.get(0).scrollHeight;
      var padding = parseInt(code.css('padding-top'))
          + parseInt(code.css('padding-bottom'));
      code.height(scrollHeight - padding).focus().blur();
      $('.share-label', code.parent()).css('line-height', (scrollHeight + 1) + 'px');
    }

  });
});
