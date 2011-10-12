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
      _.bindAll(this, 'render', 'resize', 'destroy', 'show');
      App.subscribe('NotAuthenticated', 'destroy');
      App.subscribe('ShowFolderItem-' + args.targetClass, this.show);
      return this;
    },

    render: function (opts, template) {
      var tabs = $('.tab-dynamic');
      var nextTo = $(tabs.get(tabs.length - 1));
      var left = nextTo.length !== 0 ?
          nextTo.offset().left + nextTo.width() - 10 :
          opts.left;
      opts = opts || {};
      _.defaults(opts, {
        title: null,
        targetClass: this.options.targetClass,
        vehicleId: null,
        tabLeft: left,
        tabIndex: tabs.length,
        tabParent: '.tabs-dynamic',
        active: false,
        tabClosable: true,
        dynamic: true,
      });
      this.el = App.engine(template, opts)
          .appendTo('.folder');
      this.tab = App.engine('tab.jade', opts)
          .appendTo(opts.tabParent);
      this.tab.click(_.bind(this.show, this));
      $('.tab-closer', this.tab).click(_.bind(this.destroy, this));
      $('.resize-horizontal', this.el)
          .bind('mousedown', _.bind(this.resizeHorizontal, this));
      if (opts.active)
        this.tab.click();
    },

    show: function (e) {
      if (e && $(e.target).hasClass('tab-closer')) return;
      $('.tab-active').each(function (i) {
        var $this = $(this);
        $this.removeClass('tab-active');
        $this.css({ zIndex: parseInt($this.css('z-index')) - 10001 });
        flipTabSides($this);
        $('.tab-content', $this).addClass('tab-content-inactive');
      });
      this.tab.addClass('tab-active');
      this.tab.css({ zIndex: 10001 + parseInt(this.tab.css('z-index')) });
      flipTabSides(this.tab);
      $('.tab-content', this.tab).removeClass('tab-content-inactive');
      var target = $('.' + this.tab.attr('data-tab-target'));
      $('.tab-target').hide();
      target.show();
      App.publish('WindowResize');
      function flipTabSides(ctx) {
        var sides = $('.tab-side img', ctx);
        sides.each(function (i) {
          var $this = $(this),
              old = $this.attr('src'),
              noo = $this.attr('alt');
          $this.attr({ src: noo, alt: old });
        });
      }
    },

    destroy: function (e) {
      var targetIndex = this.tab.attr('data-tab-index');
      var tabs = $('.tab-dynamic');
      console.log(tabs, targetIndex, $(tabs.get(targetIndex-1)));
      if (this.tab.hasClass('tab-active'))
        App.publish('ShowFolderItem-'+
            $(tabs.get(targetIndex-1)).data('tabTarget'));
      this.tab.remove();
      tabs = $('.tab-dynamic');
      var offset = 30;
      tabs.each(function (t) {
        var tab = $(tabs.get(t));
        tab.css({ left: offset + 'px' });
        tab.attr('data-tab-index', t);
        offset += tab.width() - 10;
      });
      this.remove();
      return this;
    },

    resizeHorizontal: function (e) {
      e.preventDefault()
      var target = $(e.target);
      if (!target.hasClass('resize-horizontal'))
        target = target.closest('.resize-horizontal');
      var left = $(target.siblings().get(0));
      var right = $(target.siblings().get(1));
      var target_left_orig = parseInt(target.offset().left);
      var left_w_orig = left.width();
      var right_w_orig = right.width();
      var mouse_orig = { x: e.pageX, y: e.pageY };
      var movehandle = _.debounce(function (e) {
        var m = { x: e.pageX, y: e.pageY };
        var lw = left_w_orig + (m.x - mouse_orig.x);
        var rw = right_w_orig - (m.x - mouse_orig.x);
        if (lw < 200 || rw < 200) return false;
        left.width(lw);
        right.width(rw);
        target.css({
          left: target_left_orig + (m.x - mouse_orig.x) + 'px',
        })
        App.publish('WindowResize');
      }, 0);
      $(document).bind('mousemove', movehandle);
      $(document).bind('mouseup', function (e) {
        $(this).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
    },

    // arrangeVertical: function (e) {
    //   var target = $(e.target);
    //   var top = $(target.siblings().get(0));
    //   var bottom = $(target.siblings().get(1));
    //   var target_top_orig = parseInt(target.offset().top);
    //   var top_h_orig = top.height();
    //   var bottom_h_orig = bottom.height();
    //   var mouse_orig = { x: e.pageX, y: e.pageY };
    //   var movehandle = _.debounce(function (e) {
    //     var m = { x: e.pageX, y: e.pageY };
    //     var th = top_h_orig + (m.y - mouse_orig.y);
    //     var bh = bottom_h_orig - (m.y - mouse_orig.y);
    //     if (th < 100 || bh < 100) return false;
    //     top.height(th);
    //     bottom.height(bh);
    //     target.css({
    //       top: target_top_orig + (m.y - mouse_orig.y) + 'px',
    //     })
    //     App.publish('WindowResize');
    //   }, 0);
    //   $(document).bind('mousemove', movehandle);
    //   $(document).bind('mouseup', function (e) {
    //     $(this).unbind('mousemove', movehandle)
    //         .unbind('mouseup', arguments.callee);
    //   });
    // },

    resize: function (e) {
      return this;
    },

  });
});

