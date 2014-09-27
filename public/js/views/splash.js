/*
 * Page view for splash.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/splash.html',
  'views/lists/events',
  'views/lists/datasets.sidebar',
  'fancybox_plugins'
], function ($, _, Backbone, mps, util, template, Events, Datasets) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
      this.options = options;
    },

    render: function () {
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Save refs.
      this.top = this.$('.splash-top');
      this.topBottom = this.$('.splash-top-bottom');
      this.bottom = this.$('.splash-bottom');
      this.iframe = this.$('iframe');
      this.dots = this.$('.splash-embed-dots li');

      // Handle resizing.
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      this.resize();

      // Render lists.
      this.events = new Events(this.app, {
        parentView: this,
        reverse: true,
        filters: false,
        headers: false
      });
      this.library = new Datasets(this.app, {
        parentView: this,
        reverse: true,
        library: true
      });

      // Handle video.
      this.$('.splash-play-video').fancybox({
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        width: 800,
        height: 500,
        padding: 0,
        margin: [-30,0,0,0],
        helpers: {
          media: true
        },
        vimeo: {
          autoplay: 1
        }
      });

      this.rotate();

      return this;
    },

    events: {
      'click .splash-embed-dots': 'rotate',
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.events.destroy();
      this.library.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    resize: function (e) {
      if (this.top.length) {
        var h = $(window).height();
        var t = ((h - 660) / 2) - 120;
        this.top.css('margin-top', Math.max(t, 30));
        this.topBottom.height(Math.max(150, h - this.topBottom.offset().top));
      }
    },

    rotate: function (e) {
      if (this.rotating) {
        return;
      }
      // if (this.timeout) {
      //   clearTimeout(this.timeout);
      // }
      this.rotating = true;
      var active = $('.active', this.dots.parent());
      var nextIndex;
      if (!active.get(0)) {
        active = this.dots.eq(Math.floor(Math.random()*this.dots.length))
            .addClass('active');
        nextIndex = active.index();
      } else {
        nextIndex = e ? $(e.target).index(): active.index() + 1;
      }
      if (nextIndex === this.dots.length) {
        nextIndex = 0;
      }
      this.dots.removeClass('active');
      var next = $(this.dots.get(nextIndex)).addClass('active');
      this.iframe.css('opacity', 0);
      _.delay(_.bind(function () {
        this.iframe.attr('src', next.data('url'));
        _.delay(_.bind(function () {
          this.iframe.css('opacity', 1);
          // this.timeout = setTimeout(_.bind(this.rotate, this), 12000);
          this.rotating = false;
        }, this), 1000);
      }, this), 200);
    },

  });
});
