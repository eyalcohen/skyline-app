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
      this.code = this.$('.code');
      this.iframe = this.$('iframe');

      // Fill in the embed code.
      var host = window.location.protocol+'//'+window.location.host+'/';
      var url = host + 'embed/' + this.options.userName + '/views/' + this.options.viewName;
      url = url.toLowerCase();
      this.update(url);

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

    update: function (str) {
      this.iframe.attr('src', str);
      this.code.html('<iframe width="100%" height="100%" '
          + 'src="' + str + '" frameborder="0"></iframe>');
      this.code.height('auto');
      var scrollHeight = this.code.get(0).scrollHeight;
      var padding = parseInt(this.code.css('padding-top'))
          + parseInt(this.code.css('padding-bottom'));
      this.code.height(scrollHeight - padding).focus().blur();
      //this.label.css('line-height', scrollHeight + 'px');
    }

  });
});
