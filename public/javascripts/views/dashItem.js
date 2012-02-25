/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery',
    'libs/jquery.mousewheel',
    'libs/mwheelIntent',
    'libs/jquery.jscrollpane',
    'jquery-extensions'],
    function ($) {
  return Backbone.View.extend({

    initialize: function (args) {
      this.firstRender = true;
      this.animate = false;
      _.bindAll(this, 'render', 'resize', 'destroy');
      App.subscribe('WindowResize', this.resize);
      App.subscribe('NotAuthenticated', this.destroy);
      return this;
    },

    setup: function () {
      this.toggler = $('.toggler', this.el);
      this.scroller = $('.scrollable', this.el);
      this.content = $('.dashboard-item-content', this.el);
      return this;
    },

    render: function (cb) {
      this.setup();
      this.delegateEvents();
      if (this.firstRender) {
        this.firstRender = false;
        this.el.show();
        this.offset = this.options.target ?
            $('.' + this.options.target).offset() :
            this.el.offset();
        this.resize();
      } else {
        this.content.hide();
        this.el.show();
        this.resize();
        this.content.show();
        this.addScroll(cb);
      }
    },

    destroy: function () {
      if (this.timer)
        clearInterval(this.timer);
      App.unsubscribe('WindowResize', this.resize);
      App.unsubscribe('NotAuthenticated', this.destroy);
      this.remove();
      return this;
    },

    toggle: function (e) {
      var target = $(e.target);
      this.content.is(':visible') ?
        this.minimize(target) :
        this.maximize(target);
      App.publish('WindowResize');
      return this;
    },

    minimize: function () {
      this.content.hide();
      this.toggler.text('+').attr('title', 'Show');
      this.trigger('toggled', 'close');
      this.content.attr('data-height-mode', 'hidden');
      var sibs = $(this.el).parent().siblings().children();
      $('.dashboard-item-content', sibs).attr('data-height-mode', 'full');
    },

    maximize: function () {
      this.content.show();
      this.toggler.text('–').attr('title', 'Hide');
      this.trigger('toggled', 'open');
      this.content.attr('data-height-mode', '');
      var sibs = $(this.el).parent().siblings().children();
      $('.dashboard-item-content', sibs).attr('data-height-mode', '');
    },

    search: function (e) {},

    resize: function () {
      if (!this.el || this.el.length === 0)
        return;
      var win = $(window);
      if (!this.offset || this.offset.top === 0)
        this.offset = this.options.target ?
            $('.' + this.options.target).offset() :
            this.el.offset();
      if (this.options.height !== null && this.options.height !== undefined) {
        var dest;
        if (this.content.attr('data-height-mode') === 'full') {
          // HACK: account for the timeline's fixed height
          var extra = this.el.parent().parent().hasClass('dashboard-right') ? 63 : 0;
          dest = 'string' === typeof this.options.height ?
              { height: parseInt(this.options.height) } :
              { height: win.height() - this.offset.top - 39 - 19 + 20 - extra};
        } else if (this.content.attr('data-height-mode') === 'hidden')
          dest = { height: 0 };
        else {
          dest = 'string' === typeof this.options.height ?
              { height: parseInt(this.options.height) } :
              { height: Math.floor((win.height() - 76 - 57 + 20 )
                  * this.options.height / 100 - this.options.bottomPad) };
        }
        if (this.options.animate && this.options.height !== 0) {
          this.content.animate(dest, 'fast');
        } else {
          this.content.css(dest);
          this.options.animate = false; // keep this off for now...
        }
      } else {
        this.content.height(win.height() - this.offset.top - 39 + 20);
      }
      this.addScroll();
    },

    addScroll: function (cb) {
      if (this.content.hasClass('scrollable')) {
        this.content.jScrollPane({
          verticalGutter: 2,
          horizontalGutter: 2,
        });
      }
      if(cb) cb();
    },

    setTime: function () {
      $('[data-time]', this.el).each(function (i) {
        var time = $(this);
        if (!time.data('ts'))
          var src = time.attr('data-occured') || time.attr('data-time');
          time.data('ts', src);
        if (time.data('ts') !== '0')
          time.text(App.util.getRelativeTime(parseInt(time.data('ts')) / 1e3));
        else
          time.text('Never');
      });
      return this;
    },

    setDuration: function () {
      $('[data-duration]', this.el).each(function (i) {
        var $this = $(this);
        $this.text(App.util.getDuration($this.attr('data-duration')));
      });
    },

    addCommas: function (nStr) {
      nStr += '';
      var x = nStr.split('.');
      var x1 = x[0];
      var x2 = x.length > 1 ? '.' + x[1] : '';
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1))
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      return x1 + x2;
    },

  });
});

