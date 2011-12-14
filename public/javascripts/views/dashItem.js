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
      try {
        var win = $(window);
        if (this.offset.top === 0)
          this.offset = this.options.target ?
              $('.' + this.options.target).offset() :
              this.el.offset();
        if (this.options.height !== null && this.options.height !== undefined) {
          var dest = 'string' === typeof this.options.height ?
              { height: parseInt(this.options.height) } :
              { height: Math.floor((win.height() - 76 - 57)
                  * this.options.height / 100 - this.options.bottomPad) };
          if (this.options.animate && this.options.height !== 0) {
            this.content.animate(dest, 'fast');
          } else {
            this.content.css(dest);
            this.options.animate = false; // keep this off for now...
          }
        } else {
          this.content.height(win.height() - this.offset.top - 39);
        }
        this.addScroll();
      } catch (err) {
        console.log(err);
      }
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
          time.text(getRelativeTime(time.data('ts')));
        else
          time.text('Never');
      });

      function getRelativeTime (ts) {
        ts = parseInt(ts);
        var parsed_date = new Date(ts / 1e3),
            relative_to = (arguments.length > 1) ?
                arguments[1] / 1e3 : new Date(),
            delta = parseInt((relative_to.getTime() - parsed_date) / 1e3);
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
        else return new Date(ts / 1e3).toLocaleDateString();
      }
      return this;
    },

    setDuration: function () {
      $('[data-duration]', this.el).each(function (i) {
        var $this = $(this);
        $this.text(getDuration($this.attr('data-duration')));
      });

      function getDuration(delta) {
        delta = parseFloat(delta) / 1e6;
        if (delta === 0)
          return 'n / a';
        if (delta < 1)
          return (delta * 1e3).toFixed(1) + ' milliseconds';
        else if (delta < 60)
          return delta.toFixed(1) + ' seconds';
        else if (delta < (45 * 60)) 
          return (delta / 60).toFixed(1) + ' minutes';
        else if (delta < (24 * 60 * 60))
          return (delta / 3600).toFixed(1) + ' hours';
        else
          return (delta / 86400).toFixed(1) + ' days';
      }
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

