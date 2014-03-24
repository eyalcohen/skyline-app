/*
 * Share to blog / social media view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'text!../../templates/share.html',
], function ($, _, Backbone, mps, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'share',

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;

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
        padding: 0,
        modal: true,
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .modal-close': 'close',
    },

    // Misc. setup.
    setup: function () {
      this.linkCode = this.$('.link-code .code');
      this.embedCode = this.$('.embed-code .code');
      this.iframe = this.$('iframe');

      // Fill in the codes.
      var link = window.location.protocol + '//' + window.location.host + '/'
          + this.options.view.author.username + '/views/'
          + this.options.view.slug;
      var embed = (window.location.protocol === 'https:'
          ? window.location.protocol: '')
          + '//' + window.location.host + '/embed/'
          + this.options.view.author.username + '/views/'
          + this.options.view.slug;
      this.updateCodes({link: link.toLowerCase(), embed: embed.toLowerCase()});

      return this;
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
      this.empty();
    },

    close: function (e) {
      $.fancybox.close();
    },

    updateCodes: function (data) {

      // Link
      this.linkCode.html(data.link);
      this.positionLabelForCode(this.linkCode);
      
      // Embed
      if (this.iframe.length > 0) this.iframe.attr('src', data.embed);
      this.embedCode.html('<iframe width="100%" height="100%" '
          + 'src="' + data.embed + '" frameborder="0"></iframe>');
      this.positionLabelForCode(this.embedCode);
    },

    positionLabelForCode: function (code) {
      // code.height('auto');
      var scrollHeight = code.get(0).scrollHeight;
      console.log(scrollHeight)
      var padding = parseInt(code.css('padding-top'))
          + parseInt(code.css('padding-bottom'));
      code.height(scrollHeight - padding).focus().blur();
      $('.share-label', code.parent()).css('line-height', (scrollHeight + 1) + 'px');
    }

  });
});
