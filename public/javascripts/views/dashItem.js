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
      _.bindAll(this, 'render', 'resize', 'destroy', 'adjustHeight');
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
        // HACK: seems like the DOM rendering is not
        // always complete by the time we go to 
        // resize... so wait a bit and do it again.
        _.delay(this.resize, 500);
        if (this.options.weight !== 0)
          this.content.show();
        if (this.options.shrinkable)
          $('.dashboard-item-header', this.el).css({ cursor: 'ns-resize' });
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
      this.options.oldHeight = this.options.height;
      this.options.tabModel.verticalResize(this.model,
            -this.options.oldHeight + 19, { hide: true });
    },

    maximize: function () {
      this.content.show();
      this.toggler.text('–').attr('title', 'Hide');
      var total = $(window).height() - this.offset.top - 19;
      var delta = this.options.oldHeight - 19 > total - 50 ?
                  total * this.options.oldWeight / 100 :
                  this.options.oldHeight - 19;
      this.options.tabModel.verticalResize(this.model,
            delta, { show: true });
    },

    search: function (e) {},

    resize: function (delta) {
      if (!this.el || this.el.length === 0)
        return;
      var win = $(window);
      var hh = this.options.headless ? 0 : 19;
      if (!this.offset || this.offset.top === 0)
        this.offset = this.options.target ?
            $('.' + this.options.target).offset() :
            this.el.offset();

      var total = win.height() - this.offset.top;
      var oh = this.options.height;

      if ('number' === typeof oh) {
        if (delta && this.options.weight) {
          if (this.options.type === 'graph') {
            if (this.options.tabModel.graphModels.length === 1)
              oh += Math.round(delta * this.options.weight / 100);
            else {
              var j = this.options.tabModel.graphModels.indexOf(this.model) % 2;
              if (j > 0)
                oh += Math.floor(delta * this.options.weight / 100);
              else
                oh += Math.round(delta * this.options.weight / 100);
            }
          } else oh += Math.round(delta * this.options.weight / 100);
          this.options.height = Math.round(oh);
          this.content.height(this.options.height - hh);

          // Last check to get it right!
          if (this.options.id === 'MASTER') {
            var _this = this;
            _.delay(function () {
              var p = _this.el.parent().parent();
              var k = p.children();
              var ch = 0;
              _.each(k, function (c) { ch += $(c).height(); });
              var er = Math.floor($(window).height() - _this.offset.top - ch);
              oh += er;
              _this.options.height = Math.round(oh);
              _this.content.height(_this.options.height - hh);
            }, 100);
          }
        } else {
          this.options.height = Math.round(oh);
          this.content.height(this.options.height - hh);
        }
      } else if ('full' === oh) {
        this.content.height(total - hh);
      } else {
        var h;
        if (oh.indexOf('%') !== -1) {
          this.options.weight = Number(oh.substr(0, oh.indexOf('%')));
          h = total * this.options.weight / 100;
        } else if (oh.indexOf('px') !== -1)
          h = Number(oh.substr(0, oh.indexOf('px')));
        h -= this.options.bottomPad || 0;
        this.options.height = Math.round(h);
        this.content.height(this.options.height - hh);
      }
      this.addScroll();
    },

    adjustHeight: function (e) {
      if (this.options.weight === 0)
        return;
      var self = this;
      var doc = $(document);
      var oy = e.pageY;
      var move = _.throttle(function (e) {
        self.options.tabModel.verticalResize(self.model, oy - e.pageY);
        oy = e.pageY;
      }, 50);
      doc.bind('mousemove', move)
                  .bind('mouseup', function (e) {
        doc.unbind('mousemove', move)
                   .unbind('mouseup', arguments.callee);
      });
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

