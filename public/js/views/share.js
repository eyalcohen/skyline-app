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

    className: 'share',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.on('rendered', this.setup, this);
    },

    render: function () {

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

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .modal-close': 'close',
    },

    setup: function () {
      this.linkCode = this.$('.link-code .code');
      this.embedCode = this.$('.embed-code .code');
      this.iframe = this.$('iframe');

      // Close modal.
      $(document).on('keyup', _.bind(function (e) {
        if (e.keyCode === 27 || e.which === 27) {
          this.close();
        }
      }, this));

      // Fill in the codes.
      var path = this.options.view ?
          this.options.view.author.username + '/views/'
          + this.options.view.slug:
          this.options.dataset.author.username + '/'
          + this.options.dataset.id;
      var link = window.location.protocol + '//'
          + window.location.host + '/' + path;
      var embed = window.location.protocol + '//' + window.location.host
                  + '/embed/' + path;
      this.updateCodes({link: link.toLowerCase(), embed: embed.toLowerCase()});

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
      var scrollHeight = code.get(0).scrollHeight;
      var padding = parseInt(code.css('padding-top'))
          + parseInt(code.css('padding-bottom'));
      code.height(scrollHeight - padding).focus().blur();
      $('.share-label', code.parent())
          .css('line-height', (scrollHeight + 1) + 'px');
    }

  });
});
