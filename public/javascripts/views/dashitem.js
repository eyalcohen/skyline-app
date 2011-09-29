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
        // this.el.fadeIn('fast');
        this.el.show();
        this.offset = this.options.target ?
            $('.' + this.options.target).offset() :
            this.el.offset();
        this.resize();
      } else {
        // this.resize();
        this.content.hide();
        this.el.show();
        this.resize();
        // this.content.show('fast', _.bind(this.addScroll, this, cb));
        // this.content.fadeIn('slow', _.bind(this.addScroll, this, cb));
        this.content.show();
        this.addScroll(cb);
      }
    },

    destroy: function () {
      if (this.timer)
        clearInterval(this.timer);
      this.remove();
      return this;
    },

    toggle: function (e) {
      var target = $(e.target);
      this.content.is(':visible') ?
        this.minimize(target) :
        this.maximize(target);
      return this;
    },

    minimize: function () {
      this.content.hide('fast');
      this.toggler.text('+').attr('title', 'expand');
      this.trigger('toggled', 'close');
    },

    maximize: function () {
      this.content.show('fast');
      this.toggler.text('-').attr('title', 'shrink');
      this.trigger('toggled', 'open');
    },

    search: function (e) {},

    resize: function () {
      var win = $(window);
      if (this.offset.top === 0)
        this.offset = this.options.target ?
            $('.' + this.options.target).offset() :
            this.el.offset();
      if (this.options.height !== null && this.options.height !== undefined) {
        var dest = 'string' === typeof this.options.height ?
            { height: parseInt(this.options.height) } :
            { height: (win.height() - this.offset.top - 68)
                * this.options.height / 100 - this.options.bottomPad };
        if (this.options.animate && this.options.height !== 0) {
          this.content.animate(dest, 'fast');
        } else {
          this.content.css(dest);
          this.options.animate = false; // keep this off for now...
        }
      } else {
        this.content.height(win.height() - this.offset.top - 40);
      }
      this.addScroll();
    },

    addScroll: function (cb) {
      if (this.content.hasClass('scrollable')) {
        this.content.jScrollPane({
          verticalGutter: 2,
        });
      }
      if(cb) cb();
    },

    setTime: function () {
      $('[data-time]', this.el).each(function (i) {
        var time = $(this);
        if (!time.data('ts'))
          time.data('ts', time.attr('data-time'));
        if (time.data('ts') !== '0')
          time.text(getRelativeTime(time.data('ts')));
        else
          time.text('Never');
      });

      function getRelativeTime (ts) {
        ts = parseInt(ts);
        var parsed_date = new Date(ts / 1000),
            relative_to = (arguments.length > 1) ?
                arguments[1] / 1000 : new Date(),
            delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
        if (delta < 5) return 'just now';
        else if (delta < 15) return 'just a moment ago';
        else if (delta < 30) return 'just a few moments ago';
        else if (delta < 60) return 'less than a minute ago';
        else if (delta < 120) return 'about a minute ago';
        else if (delta < (45 * 60)) 
          return (parseInt(delta / 60)).toString() + ' minutes ago';
        else if (delta < (90 * 60)) 
          return 'about an hour ago';
        else if (delta < (24 * 60 * 60)) {
          var h = (parseInt(delta / 3600)).toString();
          if (h != '1') return 'about ' + h + ' hours ago';
          else return 'about an hour ago';
        }
        else if (delta < (2 * 24 * 60 * 60)) 
          return 'about a day ago';
        else if (delta < (10 * 24 * 60 * 60)) 
          return (parseInt(delta / 86400)).toString() + ' days ago';
        else return new Date(ts / 1000).toLocaleDateString();
      }
      return this;
    },

    setDuration: function () {
      $('[data-duration]', this.el).each(function (i) {
        var $this = $(this);
        $this.text(getDuration($this.attr('data-duration')));
      });

      function getDuration(delta) {
        delta = parseFloat(delta) / 1000;
        if (delta === 0)
          return 'n / a';
        else if (delta < 60)
          return delta + ' seconds';
        else if (delta < (45 * 60)) 
          return (delta / 60).toFixed(1) + ' minutes';
        else if (delta < (24 * 60 * 60))
          return (delta / 3600).toFixed(1) + ' hours';
        else
          return (delta / 86400).toFixed(1) + ' days';
      }
    },

    getId: function (e) {
      var str = $(e.target).parent().parent().attr('id');
      try {
        var items = str.split('_');
        return parseInt(items[items.length - 1]);
      } catch (exception) {
        return null;
      }
    },

    insertAt: function (parent, child, i) {
      if (i === 0) {
        child.prependTo(parent);
        return;
      }
      $('div:nth-child(' + i + ')', parent).before(child);
    },

  });
});

