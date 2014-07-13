/*
 * Page view for the how it works page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util'
], function ($, _, Backbone, mps, util) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Skyline | ' + this.options.title);

      this.template = _.template(this.options.template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .page-menu li a': 'subNavigate',
      'window scroll': 'scroll'
    },

    setup: function () {

      // Save refs.
      this.menu = this.$('.page-menu');

      // Handle menu scroll.
      if (this.menu.length > 0) {
        $(window).scroll(_.bind(this.scroll, this));
      }

      // Choose active item.
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1) {
        this.selectItemFromURL();
      }

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
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    subNavigate: function (e) {
      this.selecting = true;
      $('li a', this.menu).removeClass('active');
      $(e.target).closest('a').addClass('active');
      _.defer(_.bind(function () {
        this.selecting = false;
      }, this));
      
    },

    scroll: function (e) {

      // Adjust menu position.
      if ($(window).scrollTop() > this.menu.parent().offset().top) {
        this.menu.addClass('fixed');
      } else {
        this.menu.removeClass('fixed');
      }

      // Select menu item.
      if (this.selecting) {
        return false;
      }
      var id;
      var win = $(window).scrollTop();
      var pos = -Number.MAX_VALUE;
      this.$('.divider').each(function () {
        var top = $(this).offset().top - win;
        if (top <= 0 && top > pos) {
          pos = top;
          id = $(this).attr('id');
        }
      });
      if (id) {
        this.selectItemById(id);
      }
    },

    selectItemById: function (id) {
      $('li a', this.menu).removeClass('active');
      $('a[href="#' + id + '"]').addClass('active');
    },

    selectItemFromURL: function () {
      var a = _.find($('a', this.menu), function (_a) {
        return window.location.hash === $(_a).attr('href');
      });
      if (a) {
        $('li a', this.menu).removeClass('active');
        $(a).addClass('active');
      }
    } 

  });
});
