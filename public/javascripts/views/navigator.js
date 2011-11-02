/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize');
      _.bindAll(this, 'destroy', 'draw', 'drawWindow', 
                'moveWindow', 'hoverWindow', 'exitWindow',
                'passWindowEvent', 'hookScale', 'plotDrawHook',
                'showNotification', 'hideNotification');
      var tabId = args.tabId;
      App.subscribe('PreviewNotification-' + tabId, this.showNotification);
      App.subscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.subscribe('HideVehicle-' + tabId, this.destroy);
      App.subscribe('VisibleTimeChange-' + tabId, this.draw);
      this.debouncedDrawWindow = _.debounce(this.drawWindow, 20);
      this.ready = false;
      this.dragging = false;
      this.action = 'move';
    },

    destroy: function () {
      this._super('destroy');
      var tabId = this.options.tabId;
      App.unsubscribe('PreviewNotification-' + tabId, this.showNotification);
      App.unsubscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.unsubscribe('HideVehicle-' + tabId, this.destroy);
      App.unsubscribe('VisibleTimeChange-'+ tabId, this.draw);
    },

    events: {
      'click .toggler': 'toggle',
      'mousedown .navigator-window': 'moveWindow',
      'mousemove .navigator-window': 'hoverWindow',
      'mouseleave .navigator-window': 'exitWindow',
      'mousewheel .navigator-window': 'passWindowEvent',
      'DOMMouseScroll .navigator-window': 'passWindowEvent',
      'dblclick .navigator-window': 'passWindowEvent',
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
      this.notificationPreview = $('.notification-preview', this.el);
      this._super('render', _.bind(function () {
        if (!opts.loading && !opts.empty)
          this.ready = true;
          this.draw(this.options.timeRange.beg,
                    this.options.timeRange.end);
      }, this));
    },

    resize: function () {
      this._super('resize');
      if (this.plot && 
          this.plot.getPlaceholder().is(':visible')) {
        var width = this.content.width();
        var height = this.content.height()
        this.plot.getPlaceholder().css({
          width: width,
          height: height,
        });
        this.plot.setCanvasDimensions(width, height)
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    createPlot: function (beg, end) {
      var self = this;
      var data = _.pluck(self.collection.models, 'attributes');
      var shapes = [];
      var sortedData = _.stableSort(data,
              function(s1, s2) {
        var d1 = s1.end - s1.beg;
        var d2 = s2.end - s2.beg;
        return d2 - d1;
      });
      _.each(sortedData, function (pnt) {
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
      self.holder = $('.navigator > div', self.content);
      self.expandTime(beg / 1e3, end / 1e3,
                      function (beg, end) {
        self.plot = $.plot(self.holder, [], {
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
        self.hookScale();
      });

      function bindEventsHook(plot, eventHolder) {
        plot.getPlaceholder()
            .bind('mousewheel DOMMouseScroll', function (e, delta) {
              graphZoomClick(e, e.shiftKey ? 1.25 : 1.05, delta < 0);
              return false;
            })
            .dblclick(function (e) {
              graphZoomClick(e, e.shiftKey ? 8 : 2, e.altKey || e.metaKey);
            });
        $('canvas.flot-overlay', self.content)
            .bind('drag', self.debouncedDrawWindow);
        
        function graphZoomClick(e, factor, out) {
          var c = plot.offset();
          c.left = e.pageX - c.left;
          c.top = e.pageY - c.top;
          if (out)
            plot.zoomOut({ center: c, amount: factor });
          else
            plot.zoom({ center: c, amount: factor });
          self.debouncedDrawWindow();
        }
      }

      function addIcons(p, ctx) {
        var icons = $('.timeline-icon', self.holder);
        if (icons.length === 0) {
          _.each(data, function (pnt) {
            var off = p.pointOffset({ x: pnt.beg / 1e3, y: 0.22 });
            var icon = $('<img>')
                .attr({ src: pnt.icon })
                .css({
                  left: off.left - 8 + 'px',
                  top: off.top + 'px',
                })
                .addClass('timeline-icon')
                .appendTo(self.holder);
          });
          $('img', self.holder)
              .bind('mousedown mouseup mousemove DOMMouseScroll mousewheel',
              function (e) {
                if (e.type === 'mousedown' || 
                    e.type === 'mousemove')
                  $('.flot-overlay', self.content).trigger(e);
                else
                  if (e.type === 'mouseup')
                    self.plot.getPlaceholder().css({ cursor: 'default' });
                else
                  self.passWindowEvent(e);
              });
        } else {
          _.each(data, function (pnt, i) {
            var off = p.pointOffset({ x: pnt.beg / 1e3, y: 0.22 });
            $(icons.get(i)).css({
              left: off.left - 8 + 'px',
              top: off.top + 'px',
            });
          });
        }
      }
    },

    draw: function (beg, end) {
      var self = this;
      self.zoomedRange = { min: beg / 1e3, max: end / 1e3 };
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
      this.debouncedDrawWindow(beg, end);
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

    hookScale: function () {
      var self = this;
      var xopts = this.plot.getAxes().xaxis.options;
      $('.minute-scale', self.el).click(function (e) {
        zoomToRange(60*1e3);
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
        var center = (self.zoomedRange.min + 
                      self.zoomedRange.max) / 2;
        xopts.min = (center - range / 2);
        xopts.max = (center + range / 2);
        self.plot.setupGrid();
        self.plot.draw();
        self.drawWindow();
      };
    },

    drawWindow: function (beg, end) {
      var self = this;
      if (!_.isNumber(beg) || !_.isNumber(end)) {
        beg = self.boxBeg;
        end = self.boxEnd;
      } else {
        beg = Math.round(beg);
        end = Math.round(end);
      }
      self.boxBeg = beg;
      self.boxEnd = end;
      var off = $(self.options.parent).offset();
      var xaxis = self.plot.getXAxes()[0];
      var left = xaxis.p2c(beg);
      var width = Math.max(xaxis.p2c(end) - left, 14);
      var display = 'block';
      var borderLeft = '1px dashed rgba(0, 0, 0, 0.3)';
      if (left < 0) {
        width = width + left;
        left = 0;
        borderLeft = 'none';
        if (width <= 0)
          display = 'none';
      }
      if (left > self.el.width()) {
        display = 'none';
      } else if (left + width > self.el.width()) {
        width = self.el.width() - left;
      }
      left = Math.floor(left);
      width = Math.floor(width);
      self.visibleBox.css({
        display: display,
        left: left + 'px',
        width: width + 'px',
        borderLeft: borderLeft,
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
          posl = outerWidth - boxWidth - 2;
          posr = outerWidth;
          publish = false;
        }
        var css = { borderLeft: '1px dashed rgba(0, 0, 0, 0.3)' };
        switch (self.action) {
          case 'move' :
            css.left = posl + 'px';
            break;
          case 'e-resize' :
            css.left = posl + 'px';
            css.width = boxWidth - delta;
            break;
          case 'w-resize' :
            css.width = boxWidth + delta;
            break;
        }
        if (!css.width || css.width > 20) {
          self.visibleBox.css(css);
          if (publish) {
            self.boxBeg = leftTime;
            self.boxEnd = rightTime;
            App.publish('VisibleTimeChange-' + self.options.tabId,
                [self.boxBeg * 1e3, self.boxEnd * 1e3]);
          }
        }
      }, 0);
      $(document).bind('mouseup', function (e) {
        self.dragging = false;
        $(document).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
      $(document).bind('mousemove', movehandle);
    },

    hoverWindow: function (e) {
      if (this.dragging) return;
      var side = this.getWindowSide(e);
      if (side == 'left') {
        this.action = 'e-resize';
        this.content.css({ cursor: 'e-resize' });
      }
      else if (side == 'right') {
        this.action = 'w-resize';
        this.content.css({ cursor: 'w-resize' });
      } else {
        this.action = 'move';
        this.content.css({ cursor: 'move' });
      }
    },

    exitWindow: function (e) {
      if (!this.dragging)
        this.content.css({ cursor: 'default' });
    },

    passWindowEvent: function (e) {
      this.plot.getPlaceholder().trigger(e, e.wheelDelta || -e.detail);
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

    showNotification: function (range, other) {
      this.visibleBox.hide();
      var xaxis = this.plot.getXAxes()[0];
      var leftSide = Math.max(xaxis.p2c(range.beg/1e3), 0);
      var rightSide = Math.min(xaxis.p2c(range.end/1e3), this.plot.width());
      if (leftSide < this.plot.width() && rightSide > 0) {
        this.notificationPreview.css({
          left: leftSide + 'px',
          width: rightSide - leftSide + 'px',
        }).show();
      }
    },

    hideNotification: function () {
      this.notificationPreview.hide();
      this.visibleBox.show();
    },

  });
});

