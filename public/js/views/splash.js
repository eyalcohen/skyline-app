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

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      // Attach a ref to 'update' to the window so it can be
      // reached by the iframe source.
      document.__update = _.bind(this.updateCodes, this);
    },

    render: function () {

      // Set page title
      this.app.title('Timeline');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Save refs.
      this.embedCode = this.$('.embed-code .code');
      this.iframe = this.$('iframe');

      // Fill in the codes.
      this.updateCodes({embed: this.iframe.attr('src').toLowerCase()});

      return this;
    },

    events: {
      'click .splash-button': 'signin',
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

    signin: function (e) {
      e.preventDefault();
      mps.publish('modal/signin/open');
    },

    updateCodes: function (data) {

      // Embed
      if (this.iframe.length > 0) this.iframe.attr('src', data.embed);
      this.embedCode.text('<iframe width="100%" height="100%" '
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
