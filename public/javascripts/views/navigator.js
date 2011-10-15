/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize');
      _.bindAll(this, 'drawWindow', 'moveWindow', 'hoverWindow',
          'wheelWindow', 'hookScale', 'plotDrawHook');
      App.subscribe('VisibleTimeChange-' + args.vehicleId, this.drawWindow);
    },
    
    events: {
      'click .toggler': 'toggle',
      'mousedown .navigator-window': 'moveWindow',
      'mousemove .navigator-window': 'hoverWindow',
      'mousewheel .navigator-window': 'wheelWindow',
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
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('navigator.dash.jade', opts).appendTo(parent);
      this._super('render', _.bind(function () {
        if (!this.firstRender && !opts.loading 
              && !opts.waiting && !opts.empty) {
          this.draw();
        }
      }, this));
    },

    draw: function () {
      var self = this;
      var data = _.pluck(self.collection.models, 'attributes');
      var bounds = [], shapes = []
      var holder = $('.navigator > div', self.content);
      bounds = [
        _.min(_.pluck(data, 'beg')) / 1e3,
        _.max(_.pluck(data, 'end')) / 1e3
      ];
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
      var pad = 60 * 60 * 1e3;
      var min = self.options.timeRange.min;
      var max = self.options.timeRange.max;
      if (!self.options.timeRange.snap) {
        min -= 60*60*24*7*26*1e3; // half year
        max += 60*60*24*7*26*1e3;
      } else {
        var extra = (max - min) * 0.1;
        min -= extra; // 10%
        max += extra;
      }
      self.plot = $.plot(holder,
          [[bounds[0], 0], [bounds[1], 1]], {
        xaxis: {
          mode: 'time',
          position: 'top',
          min: min,
          max: max,
          tickColor: '#ddd',
          labelsInside: true,
          // zoomRange: [1, (bounds[1] + pad) - (bounds[0] - pad)],
          // panRange: [bounds[0] - pad, bounds[1] + pad],
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
          borderWidth: 0,
          minBorderMargin: 0,
          fullSize: true,
        },
        zoom: {
          interactive: true,
          amount: 1.25,
        },
        pan: {
          interactive: true,
          frameRate: 60,
        },
        hooks: {
          draw: [addIcons, self.drawWindow, self.plotDrawHook] },
      });
      self.drawWindow(self.options.timeRange.min*1e3,
            self.options.timeRange.max*1e3);
      self.plotDrawHook();
      function addIcons(p, ctx) {
        $('.icon', holder).remove();
        _.each(data, function (pnt) {
          var off = p.pointOffset({ x: pnt.beg / 1e3, y: 0.22 });
          var icon = $('<img>')
              .attr({ src: pnt.icon })
              .css({
                left: off.left - 8 + 'px',
                top: off.top + 'px',
              })
              .addClass('icon')
              .appendTo(holder);
        });
        // FIXME: only zooms in when hovering img and wheeling
        $('img', holder).bind('mousedown, DOMMouseScroll, '+
            'mousewheel', function (e) {
          if (e.preventDefault) e.preventDefault();
          var $this = $(this);
          $this.hide();
          var receiver = document.elementFromPoint(e.clientX,e.clientY);
          if (receiver.nodeType == 3) { // Opera
            receiver = receiver.parentNode;
          }
          $(receiver).trigger(e);
          $this.show();
        });
      }
      $('.navigator', self.content).data({ plot: self.plot });
      self.box = $(self.options.parent + ' .navigator-window');
      self.hookScale();

      return self;
    },

    drawWindow: function (min, max) {
      var self = this;
      if (!self.box || self.box.length === 0) {
        self.box = $(self.options.parent + ' .navigator-window');
        return;
      }
      var lh = $(self.options.parent + ' .navigator-window-handle-left');
      var rh = $(self.options.parent + ' .navigator-window-handle-right');
      if (_.isNumber(min) && _.isNumber(max)) {
        self.windowMin = min / 1e3;
        self.windowMax = max / 1e3;
      }
      var off = $(self.options.parent).offset();
      var axis = self.plot.getXAxes()[0];
      var left = axis.p2c(self.windowMin);
      var width = Math.max(axis.p2c(self.windowMax) - left, 14);
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
      self.box.css({
        display: display,
        left: left + 'px',
        width: width + 'px',
      });
      lh.css({
        display: display,
        left: left + 2 + 'px',
      });
      rh.css({
        display: display,
        left: left + width - 5 + 'px',
      });
    },

    moveWindow: function (e) {
      var self = this;
      var mouse_orig = { x: e.pageX, y: e.pageY };
      var boxLeft = parseInt(self.box.offset().left);
      var boxRight = boxLeft + self.box.width();
      var side = self.getWindowSide(e);
      var parentOff = parseInt(self.el.offset().left);
      var axis = self.plot.getXAxes()[0];
      var movehandle = _.debounce(function (e) {
        var m = { x: e.pageX, y: e.pageY };
        var delta = m.x - mouse_orig.x;
        var leftTime = !side || side === 'left' ?
            axis.c2p(boxLeft + delta - parentOff) :
            axis.c2p(boxLeft - parentOff);
        var rightTime = !side || side === 'right' ?
            axis.c2p(boxRight + delta - parentOff) :
            axis.c2p(boxRight - parentOff);
        App.publish('VisibleTimeChange-' + self.options.vehicleId,
            [leftTime * 1e3, rightTime * 1e3]);
      }, 0);
      $(document).bind('mouseup', function (e) {
        $(document).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
      $(document).bind('mousemove', movehandle);
    },

    hoverWindow: function (e) {
      var side = this.getWindowSide(e);
      if (side == 'left')
        this.box.css({ cursor: 'e-resize' });
      else if (side == 'right')
        this.box.css({ cursor: 'w-resize' });
      else
        this.box.css({ cursor: 'move' });
    },

    wheelWindow: function (e) {
      var newTarget = $(this.plot.getCanvas()).siblings().get(0);
      var delta = (e.wheelDelta / Math.abs(e.wheelDelta)) *
          ((this.plot.getOptions().zoom.amount - 1) / 10);
      $(newTarget).trigger(e, [delta]);
    },

    getWindowSide: function (e) {
      var m = { x: e.pageX, y: e.pageY };
      var bl = parseInt(this.box.offset().left);
      var br = bl + this.box.width();
      var side;
      if (m.x - bl <= 8)
        return 'left';
      else if (br - m.x <= 8)
        return 'right';
      if (!side) return null;
    },

    // positionScale: function () {
    //   var scale = $('.navigator-scale', this.el);
    //   var parentOff = this.el.offset();
    //   scale.css({
    //     left: 10 + 'px',
    //     top: 45 + 'px',
    //   });
    // },

    hookScale: function () {
      var self = this;
      // var scale = $('.navigator-scale', self.el);
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
        var boxLeft = parseInt(self.box.offset().left);
        var boxRight = boxLeft + self.box.width();
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

    plotDrawHook: function() {
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        App.publish('NavigableTimeChange-' + this.options.vehicleId,
                    [t.beg, t.end]);
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
    },

    getVisibleTime: function() {
      if (!this.plot) return null;
      var xopts = this.plot.getAxes().xaxis.options;
      return { beg: xopts.min * 1000, end: xopts.max * 1000,
               width: this.plot.width() };
    },

    resize: function () {
      this._super('resize');
    },

  });
});

