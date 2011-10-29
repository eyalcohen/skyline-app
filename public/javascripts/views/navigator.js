/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize');
      _.bindAll(this, 'destroy', 'draw', 'moveWindow', 'hoverWindow',
          'wheelWindow', 'hookScale', 'plotDrawHook', 'preview');
      var tabId = args.tabId;
      App.subscribe('HideVehicle-' + tabId, this.destroy);
      App.subscribe('VisibleTimeChange-' + tabId, this.draw);
      this.ready = false;
      this.dragging = false;
    },

    destroy: function () {
      this._super('destroy');
      var tabId = this.options.tabId;
      App.unsubscribe('HideVehicle-' + tabId, this.destroy);
      App.unsubscribe('VisibleTimeChange-'+ tabId, this.draw);
    },

    events: {
      'click .toggler': 'toggle',
      'mousedown .navigator-window': 'moveWindow',
      'mousemove .navigator-window': 'hoverWindow',
      'mousewheel .navigator-window': 'wheelWindow',
      'mouseenter .timeline-icon': 'preview',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length)
        this.remove();
      this.plot = null;
      this.el = App.engine('navigator.dash.jade', opts)
          .appendTo(this.options.parent);
      this._super('render', _.bind(function () {
        if (!opts.loading && !opts.empty)
          this.ready = true;
          this.draw(this.options.timeRange.beg,
                    this.options.timeRange.end);
      }, this));
    },

    createPlot: function (beg, end) {
      var self = this;
      var data = _.pluck(self.collection.models, 'attributes');
      var shapes = [];
      _.each(data, function (pnt) {
        shapes.push({
          xaxis: {
            from: pnt.beg / 1e3,
            to: pnt.beg / 1e3,
          },
          color: '#999',
        });
        shapes.push({
          xaxis: {
            from: pnt.beg / 1e3,
            to: pnt.end / 1e3,
          },
          color: pnt.color,
        });
      });
      self.expandTime(beg / 1e3, end / 1e3,
                      function (beg, end) {
        self.plot = $.plot($('.navigator > div', self.content), [], {
          xaxis: {
            show: true,
            mode: 'time',
            position: 'middle',
            min: beg,
            max: end,
            tickColor: '#ddd',
            labelsInside: true,
          },
          yaxis: { 
            show: false,
            zoomRange: false,
            panRange: false,
          },
          series: {
            lines: { show: false },
            points: {},
            bars: {},
            shadowSize: 0,
          },
          grid: {
            markings: shapes,
            backgroundColor: null,
            borderWidth: 0,
            borderColor: null,
            minBorderMargin: 0,
            fullSize: true,
          },
          zoom: {
            interactive: false, // We implement zooming event handlers ourselves.
            amount: 1.25,
          },
          pan: {
            interactive: true,
            frameRate: 60,
          },
          hooks: {
            draw: [addIcons, _.bind(self.plotDrawHook, self)],
            setupGrid: [_.bind(self.plotSetupGridHook, self)],
            bindEvents: [bindEventsHook],
          },
        });
        $('.navigator', self.content).data({ plot: self.plot });
        self.visibleBox = $(self.options.parent + ' .navigator-window');
        self.leftHandle = $(self.options.parent + ' .navigator-window-handle-left');
        self.rightHandle = $(self.options.parent + ' .navigator-window-handle-right');
        self.hookScale();
      });

      function bindEventsHook(plot, eventHolder) {
        plot.getPlaceholder().mousewheel(function (e, delta) {
          graphZoomClick(e, e.shiftKey ? 2 : 1.25, delta < 0);
          return false;
        })
        .dblclick(function (e) {
          graphZoomClick(e, e.shiftKey ? 8 : 2, e.altKey || e.metaKey);
        });

        function graphZoomClick(e, factor, out) {
          var c = plot.offset();
          c.left = e.pageX - c.left;
          c.top = e.pageY - c.top;
          if (out)
            plot.zoomOut({ center: c, amount: factor });
          else
            plot.zoom({ center: c, amount: factor });
          self.drawWindow();
        }
      }

      function addIcons(p, ctx) {
        $('.timeline-icon', $('.navigator > div', self.content)).remove();
        _.each(data, function (pnt) {
          var off = p.pointOffset({ x: pnt.beg / 1e3, y: 0.22 });
          var icon = $('<img>')
              .attr({ src: pnt.icon })
              .css({
                left: off.left - 8 + 'px',
                top: off.top + 'px',
              })
              .addClass('timeline-icon')
              .appendTo($('.navigator > div', self.content));
        });
        $('img', $('.navigator > div', self.content)).bind('mousedown, DOMMouseScroll, '+
            'mousewheel', function (e) {
          if (e.preventDefault) e.preventDefault();
          var $this = $(this);
          $this.hide();
          var receiver = document.elementFromPoint(e.clientX,e.clientY);
          if (!receiver) return;
          if (receiver.nodeType == 3)
            receiver = receiver.parentNode;
          var delta = e.wheelDelta ? (e.wheelDelta / Math.abs(e.wheelDelta)) *
              ((self.plot.getOptions().zoom.amount - 1) / 10) : null;
          $(receiver).trigger(e, [delta]);
          $this.show();
        });
      }
    },

    draw: function (beg, end) {
      var self = this;
      if (!self.ready) return;
      if (!self.plot)
        self.createPlot(beg, end);
      if (!self.dragging)
        self.setVisibleTime(beg, end);
    },

    expandTime: function (beg, end, cb) {
      var factor = 5;
      var span = end - beg;
      var newSpan = span * factor;
      beg -= (newSpan - span) / 2;
      end += (newSpan - span) / 2;
      cb(beg, end);
    },

    getVisibleTime: function () {
      if (!this.plot) return null;
      var xopts = this.plot.getAxes().xaxis.options;
      return { beg: xopts.min * 1000, end: xopts.max * 1000,
               width: this.plot.width() };
    },

    setVisibleTime: function (beg, end) {
      var xopts = this.plot.getAxes().xaxis.options;
      beg /= 1000; end /= 1000;
      this.drawWindow(beg, end);
      this.expandTime(beg, end, _.bind(function (beg, end) {
        if (beg != xopts.min || end != xopts.max) {
          xopts.min = beg;
          xopts.max = end;
          this.plot.setupGrid();
          this.plot.draw();
        }
      }, this));
    },

    plotSetupGridHook: function () {},

    plotDrawHook: function () {
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        App.publish('NavigableTimeChange-' + this.options.tabId,
                    [t.beg, t.end]);
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
    },

    drawWindow: function (beg, end) {
      var self = this;
      if (!beg && !end) {
        beg = self.boxBeg;
        end = self.boxEnd;
      }
      self.boxBeg = beg;
      self.boxEnd = end;
      console.log('drawWindow( ' + [beg, end] + ' )');
      var off = $(self.options.parent).offset();
      var xaxis = self.plot.getXAxes()[0];
      var left = xaxis.p2c(beg);
      var width = Math.max(xaxis.p2c(end) - left, 14);
      var display = '';
      if (left < 0) {
        width = width + left;
        left = 0;
        if (width <= 0)
          display = 'none';
      }
      if (left > self.el.width() - 1) {
        display = 'none';
      } else if (left + width > self.el.width() - 1) {
        width = self.el.width() - left + 1;
        if (width > self.el.width() - 1)
          width -= 1;
      }
      left = Math.floor(left);
      width = Math.floor(width);
      self.visibleBox.css({
        display: display,
        left: left + 'px',
        width: width + 'px',
      });
      self.leftHandle.css({
        display: display,
        left: left + 2 + 'px',
      });
      self.rightHandle.css({
        display: display,
        left: left + width - 5 + 'px',
      });
    },

    moveWindow: function (e) {
      var self = this;
      var mouse_orig = { x: e.pageX, y: e.pageY };
      var outerWidth = self.content.width();
      var boxWidth = self.visibleBox.width();
      var boxLeft = parseInt(self.visibleBox.offset().left);
      var boxRight = boxLeft + boxWidth;
      var side = self.getWindowSide(e);
      var parentOff = parseInt(self.el.offset().left);
      var axis = self.plot.getXAxes()[0];
      var movehandle = _.debounce(function (e) {
        self.dragging = true;
        var m = { x: e.pageX, y: e.pageY };
        var delta = m.x - mouse_orig.x;
        var posl = boxLeft + delta - parentOff;
        var posr = boxRight + delta - parentOff;
        var leftTime = !side || side === 'left' ?
            axis.c2p(posl) :
            axis.c2p(boxLeft - parentOff);
        var rightTime = !side || side === 'right' ?
            axis.c2p(posr) :
            axis.c2p(boxRight - parentOff);
        var publish = true;
        if (posl <= 0) {
          posl = 0;
          posr = boxWidth;
          publish = false;
        }
        if (posr >= outerWidth) {
          posl = outerWidth - boxWidth;
          posr = outerWidth;
          publish = false;
        }
        self.visibleBox.css({
          left: posl + 'px',
        });
        self.leftHandle.css({
          left: posl + 2 + 'px',
        });
        self.rightHandle.css({
          left: posr - 5 + 'px',
        });
        if (publish)
          App.publish('VisibleTimeChange-' + self.options.tabId,
              [leftTime * 1e3, rightTime * 1e3]);
      }, 0);
      $(document).bind('mouseup', function (e) {
        self.dragging = false;
        $(document).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
      $(document).bind('mousemove', movehandle);
    },

    hoverWindow: function (e) {
      var side = this.getWindowSide(e);
      if (side == 'left')
        this.visibleBox.css({ cursor: 'e-resize' });
      else if (side == 'right')
        this.visibleBox.css({ cursor: 'w-resize' });
      else
        this.visibleBox.css({ cursor: 'move' });
    },

    wheelWindow: function (e) {
      var newTarget = $(this.plot.getCanvas()).siblings().get(0);
      var delta = (e.wheelDelta / Math.abs(e.wheelDelta)) *
          ((this.plot.getOptions().zoom.amount - 1) / 10);
      $(newTarget).trigger(e, [delta]);
    },

    getWindowSide: function (e) {
      var m = { x: e.pageX, y: e.pageY };
      var bl = parseInt(this.visibleBox.offset().left);
      var br = bl + this.visibleBox.width();
      var side;
      if (m.x - bl <= 8)
        return 'left';
      else if (br - m.x <= 8)
        return 'right';
      if (!side) return null;
    },

    hookScale: function () {
      var self = this;
      var axis = self.plot.getXAxes()[0];
      $('.second-scale', self.el).click(function (e) {
        zoomToRange(1e3);
      });
      $('.hour-scale', self.el).click(function (e) {
        zoomToRange(60*60*1e3);
      });
      $('.day-scale', self.el).click(function (e) {
        zoomToRange(60*60*24*1e3);
      });
      $('.month-scale', self.el).click(function (e) {
        zoomToRange(60*60*24*7*4*1e3);
      });
      $('.year-scale', self.el).click(function (e) {
        zoomToRange(60*60*24*7*52*1e3);
      });
      function zoomToRange(range) {
        var boxLeft = parseInt(self.visibleBox.offset().left);
        var boxRight = boxLeft + self.visibleBox.width();
        var center = axis.c2p(Math.round((boxRight + boxLeft) / 2 -
            parseInt(self.el.offset().left)));
        var min = Math.round(center - range / 2);
        var max = Math.round(center + range / 2);
        axis.options.min = min;
        axis.options.max = max;
        self.plot.setupGrid();
        self.plot.draw();
      };
    },

    preview: function (e) {
      // console.log(e);
    },

  });
});

