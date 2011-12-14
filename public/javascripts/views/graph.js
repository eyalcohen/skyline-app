/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter',
    'libs/jquery.simplemodal-1.4.1'],
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      _.bindAll(this, 'destroy', 'showNotification', 'hideNotification',
                'mouseHoverTime', 'addYaxesBoundsForDrops',
                'removeYaxesBoundsForDrops', 'ensureLegend');
      var tabId = args.tabId;
      var id = args.id;
      App.subscribe('PreviewNotification-' + tabId, this.showNotification);
      App.subscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.subscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
      App.subscribe('DragStart-' + tabId, this.addYaxesBoundsForDrops);
      App.subscribe('DragEnd-' + tabId, this.removeYaxesBoundsForDrops);
      // This is a horribly crufty way to avoid drawing the legends every time
      // the plot is redrawn but also ensure that it gets redawn when channels
      // are dropped in.
      this.ensureLegendRedraw = true;
      App.subscribe('ChannelDropped-' + id, this.ensureLegend);
    },

    destroy: function () {
      this._super('destroy');
      var tabId = this.options.tabId;
      var id = this.options.id;
      App.unsubscribe('PreviewNotification-' + tabId, this.showNotification);
      App.unsubscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.unsubscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
      App.unsubscribe('DragStart-' + tabId, this.addYaxesBoundsForDrops);
      App.unsubscribe('DragEnd-' + tabId, this.removeYaxesBoundsForDrops);
      App.unsubscribe('ChannelDropped-' + id, this.ensureLegend);
    },

    events: {
      'click .toggler': 'toggle',
      'click .fetchLatest': 'fetchLatest',
      'click .followLatest': 'followLatest',
      'click .export': 'exportCsv',
      'click .add-graph': 'addGraph',
      'click .graph-closer': 'removeGraph',
    },

    render: function (opts, fn) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length) this.remove();
      this.plot = null;
      this.el = App.engine('graph.dash.jade', opts)
          .appendTo(this.options.parent);
      this.mouseTime = $('.mouse-time', this.el);
      this.mouseTimeTxt = $('span', this.mouseTime);
      this.notificationPreview = $('.notification-preview', this.el);
      this.notificationIcons = [];
      this.minHoverDistance = 10;
      this.highlighting = false;
      this.following = false;
      this.noteBox = null;
      this._super('render');
      this.draw();
    },

    resize: function (skipDraw) {
      this._super('resize');
      if (this.plot) {
        var width = this.content.width();
        var height = this.content.height();
        if (width === 0)
          width = this.plot.getPlaceholder().closest('[data-width]').width();
        this.plot.getPlaceholder().css({
          width: width,
          height: height,
        });
        this.plot.setCanvasDimensions(width, height);
        this.noteCanvas.attr({ width: width, height: height });
        if (!skipDraw) {
          this.plot.setupGrid();
          this.plot.draw();
          this.redrawNote();
        }
      }
    },

    createPlot: function () {
      var self = this;
      self.colors = [
        "#28A128",  // Dark green
        "#cb4b4b",  // Dark red
        "#118CED",  // Dark blue
        "#E8913F",  // Orange
        "#9440ed",  // Dark purple
        "#27CDD6",  // Dark cyan
        "#B2B848",  // Dark yellow
        "#8171E3",  // Violet
        "#CC6ABE",  // Dark magenta
        "#47A890",  // Dark teal
        "#7A7A7A",  // Gray
        "#76D676",  // Light green
        "#FFA6A6",  // Pink
        "#96BDFF",  // Light blue
        "#D373FF",  // Light purple
      ];
      var visibleTime = self.model.tabModel.get('visibleTime');
      self.holder = $('.graph > div', self.content);
      self.plot = $.plot(self.holder, [], {
        xaxis: {
          mode: 'time',
          utc: true,
          twelveHourClock: true,
          position: 'bottom',
          min: visibleTime.beg / 1e3,
          max: visibleTime.end / 1e3,
          tickColor: '#f0f0f0',
          labelsInside: true,
          tickFormatter: function (val, axis) {
            var visible = self.getVisibleTime();
            var span = (visible.end - visible.beg) / 1e3;
            var date = new Date(val);
            return span < 86400000 ?
              App.util.toLocaleString(date, 'h:MM:ss TT') :
              App.util.toLocaleString(date, 'm/d/yy');
          }
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 0,
          zoomRange: false,
          panRange: false,
          tickColor: '#f0f0f0',
          labelsInside: true,
        },
        yaxes: [
          { position: 'left' },
          { position: 'right', alignTicksWithAxis: 1 }
        ],
        series: {
          lines: { lineWidth: 1 },
          points: {},
          bars: {},
          shadowSize: 1,
        },
        grid: {
          markings: weekendAreas,
          backgroundColor: null,
          borderWidth: 0,
          borderColor: null,
          clickable: false,
          hoverable: false,
          autoHighlight: false,
          minBorderMargin: 0,
          fullSize: true,
        },
        crosshair: { mode: 'x' },
        zoom: {
          interactive: false, // We implement zooming event handlers ourselves.
        },
        pan: {
          interactive: true,
          frameRate: 60,
          useShiftKey: true,
          onShiftDragStart: _.bind(self.beginNote, self),
          onShiftDrag: _.throttle(_.bind(self.drawNote, self), 20),
          onShiftDragEnd: _.bind(self.endNote, self),
          cancelShiftDrag: _.bind(self.cancelNote, self),
        },
        legend: {
          margin: [40, 0],
          oneperyaxis: true,
          labelFormatter: function(label, series) {
            return "<div data-channel='" + JSON.stringify(series.channel) + "' "+
                'data-channel-name="' + series.channel.channelName + '">'+
                '<span class="jstree-draggable" style="cursor:pointer">'+
                label + '</span></div>';
          },
        },
        hooks: {
          draw: [_.bind(self.plotDrawHook, self)],
          setupGrid: [_.bind(self.plotSetupGridHook, self)],
          bindEvents: [bindEventsHook],
        },
      });
      self.plot.lockCrosshair();  // Disable default crosshair movement.
      $('.graph', self.content).data({
        plot: self.plot,
        id: self.options.id,
      });
      self.noteCanvas = $('<canvas width="' + self.plot.getPlaceholder().width()
                        + '" height="' + self.plot.getPlaceholder().height()
                        + '" class="note-canvas">').appendTo('.graph > div', self.content);
      self.noteCtx = self.noteCanvas.get(0).getContext('2d');

      function bindEventsHook(plot, eventHolder) {
        plot.getPlaceholder().mousemove(function (e) {
          var mouse = self.getMouse(e, plot);
          var xaxis = plot.getXAxes()[0];
          var time = xaxis.c2p(mouse.x);
          // If we're hovering over the legend, don't do data mouseover.
          if (inLegend(e.target))
            mouse = null;
          App.publish('MouseHoverTime-' + self.model.get('tabId'),
                      [time * 1e3, mouse, self]);
        })
        .bind('mouseout', function (e) {
          App.publish('MouseHoverTime-' + self.model.get('tabId'), [null]);
        })
        .mousewheel(function (e, delta) {
          if (self.noteBox) return;
          graphZoomClick(e, e.shiftKey ? 2 : 1.25, delta < 0);
          return false;
        })
        .dblclick(function (e) {
          if (self.noteBox) return;
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
        }
      }

      function inLegend(elem) {
        while (elem) {
          if (elem.className == 'legend') return true;
          elem = elem.parentNode;
        }
        return false;
      }

      function weekendAreas(axes) {
        var markings = [];
        var d = new Date(axes.xaxis.min);
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
        d.setUTCSeconds(0);
        d.setUTCMinutes(0);
        d.setUTCHours(0);
        var i = d.getTime();
        do {
          markings.push({
            xaxis: { from: i, to: i + 2*24*60*60*1000 },
            color: '#fcfcfc',
          });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);
        return markings;
      }
    },

    draw: function () {
      var self = this;
      if (!self.plot)
        self.createPlot();
      var emptyDiv = $('.empty-graph', self.content);
      if (self.model.get('channels').length === 0 
          && emptyDiv.length === 0) {
        App.engine('empty_graph.jade').appendTo(self.content);
        $('.flot-base, .flot-overlay', self.plot.getPlaceholder()).hide();
        $('.graph', self.content).hide();
        self.plot.getOptions().crosshair.mode = null;
      } else if (self.model.get('channels').length > 0 
          && emptyDiv.length > 0) {
        emptyDiv.remove();
        $('.flot-base, .flot-overlay', self.plot.getPlaceholder()).show();
        $('.graph', self.content).show();
        self.resize(true);
        self.plot.getOptions().crosshair.mode = 'x';
      }
      var opts = self.plot.getOptions();
      var numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesLeftAxis++;
        else
          numSeriesRightAxis++;
      });
      var yAxisNumToUse = numSeriesLeftAxis > numSeriesRightAxis ? 2 : 1;
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum)
          channel.yaxisNum = yAxisNumToUse;
      });
      var series = [];
      _.each(self.model.get('channels'), function (channel, i) {
        var highlighted = self.highlighting === channel.channelName;
        var seriesBase = {
          xaxis: 1,
          yaxis: channel.yaxisNum,
          channel: channel,
          channelIndex: i,
        };
        var data = self.model.data[channel.channelName] || [];
        series.push(_.extend({
          lines: {
            show: true,
            lineWidth: 1,
            fill: false,
          },
          data: data,
          label: channel.title,
        }, seriesBase));
        var dataMinMax = self.model.dataMinMax[channel.channelName] || [];
        if (dataMinMax.length > 0) {
          series.push(_.extend({
            lines: {
              show: true,
              lineWidth: 0,
              fill: 0.6,
            },
            data: dataMinMax,
          }, seriesBase));
        }
      });
      self.updateSeriesColors(series);
      self.plot.setData(series);
      self.plot.setupGrid();
      self.plot.draw();
    },

    updateSeriesColors: function(series) {
      var self = this;
      series.forEach(function(s, i) {
        var highlighted = self.highlighting === s.channel.channelName;
        var color = self.colors[s.channel.colorNum % self.colors.length];
        if (self.highlighting && !highlighted) {
          // Lighten color.
          color = $.color.parse(color);
          color.r = Math.round((color.r + 255*2) / 3);
          color.g = Math.round((color.g + 255*2) / 3);
          color.b = Math.round((color.b + 255*2) / 3);
          color = color.toString();
        }
        s.color = color;
        if (s.lines.fill)
          s.zorder = highlighted ? 50000 : s.channelIndex;
        else
          s.zorder = 10000 + (highlighted ? 50000 : s.channelIndex);
      });
    },

    plotSetupGridHook: function() {
      if (!this.plot) return;
      var xopts = this.plot.getAxes().xaxis.options;
      var xmin = xopts.min, xmax = xopts.max;
      var yAxes = this.plot.getYAxes();
      // Automatically change Y-axis bounds based on visible data.
      yAxes.forEach(function(axis) {
        axis.datamin = Infinity;
        axis.datamax = -Infinity;
      });
      // TODO: this is ugly, and probably slow.
      this.plot.getData().forEach(function(series) {
        var max = series.yaxis.datamax, min = series.yaxis.datamin;
        var prevTime = null;
        series.data.forEach(function(p) {
          if (p && prevTime && p[0] >= xmin && prevTime <= xmax) {
            max = Math.max(max, p[1]);
            min = Math.min(min, p[2] == null ? p[1] : p[2]);
          }
          prevTime = p && p[0];
        });
        series.yaxis.datamax = max;
        series.yaxis.datamin = min;
      });
      yAxes.forEach(function(axis) {
        if (!(isFinite(axis.datamin) && isFinite(axis.datamax))) {
          axis.datamin = 0; axis.datamax = 1;
        } else if (axis.datamin == axis.datamax) {
          axis.datamin -= 0.5; axis.datamax += 0.5;
        }
      });
      
      if (this.prevNumChannels !== this.model.get('channels').length
          || this.ensureLegendRedraw) {
        this.setupLegend();
        this.prevNumChannels = this.model.get('channels').length;
      }
    },

    plotDrawHook: function() {
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        this.trigger('VisibleTimeChange', { beg: t.beg, end: t.end });
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
      if (t.width != this.prevWidth) {
        this.trigger('VisibleWidthChange', t.width);
        this.prevWidth = t.width;
      }
      this.positionIcons();
    },

    setupIcons: function () {
      var self = this;
      if (self.notificationIcons.length > 0)
        self.notificationIcons.remove();
      var notifications =
          _.stableSort(_.pluck(self.model.get('notifications'), 'attributes'),
          function(s1, s2) {
        return (s2.end - s2.beg) - (s1.end - s1.beg);
      });
      _.each(notifications, function (not) {
        var icon = $('<img>')
            .attr({ src: not.icon })
            .css({ bottom: 20 })
            .addClass('timeline-icon')
            .data('beg', not.beg)
            .appendTo(self.holder)
            .bind('mousedown mouseup mousemove DOMMouseScroll mousewheel', function (e) {
              if (e.type === 'mousedown' || 
                  e.type === 'mousemove')
                $('.flot-overlay', self.content).trigger(e);
              else
                if (e.type === 'mouseup')
                  self.plot.getPlaceholder().css({ cursor: 'default' });
              else passWindowEvent(e);
            });
      });
      self.notificationIcons = $('.timeline-icon', self.holder);
      self.positionIcons();

      function passWindowEvent(e) {
        self.plot.getPlaceholder().trigger(e, e.wheelDelta || -e.detail);
      }
    },

    positionIcons: function () {
      var xaxis = this.plot.getXAxes()[0];
      _.each(this.notificationIcons, function (icon, i) {
        var $icon = $(icon);
        $icon.css({
          left: xaxis.p2c($icon.data('beg') / 1e3) - 8,
        });
      });
    },

    setupLegend: function () {
      // console.log('drawLegend( ' + this.options.id + ' )...');
      this.plot.setupLegend(_.bind(function (okay) {
        if (okay)
          this.ensureLegendRedraw = false;
      }, this));
      $('.label-closer', this.content)
          .click(_.bind(this.removeChannel, this));
      $('.legend tr', this.content)
          .bind('mouseover', _.bind(this.enterLegend, this))
          .bind('mouseout', _.bind(this.leaveLegend, this));
      // add note channels from legend
      $('.legendLabel', this.content).bind('click',
          _.bind(this.addNoteChannelFromLabel, this));
    },

    getVisibleTime: function() {
      if (!this.plot) return null;
      var xopts = this.plot.getAxes().xaxis.options;
      return { beg: xopts.min * 1000, end: xopts.max * 1000,
               width: this.plot.width() };
    },

    setVisibleTime: function(beg, end) {
      var xopts = this.plot.getAxes().xaxis.options;
      beg /= 1000; end /= 1000;
      if (beg != xopts.min || end != xopts.max) {
        xopts.min = beg;
        xopts.max = end;
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    mouseHoverTime: function(time, mouse, graph) {
      var self = this;
      if (time != null)
        time = time / 1e3;
      if (time == null)
        self.plot.clearCrosshair();
      else
        self.plot.setCrosshair({x: time});
      if (time != null) {
        self.mouseTime.show();
        // TODO: finer than 1 second granularity.
        var date = new Date(Math.round(time));
        self.mouseTimeTxt.text(
                App.util.toLocaleString(
                date, 'dddd m/d/yy h:MM:ss TT Z'));
      } else {
        self.mouseTime.hide();
      }
      if (time == null) {
        if (self.highlightedLabel)
          self.highlightedLabel.removeClass('label-highlight');
        self.highlighting = false;
        self.updateSeriesColors(self.plot.getData());
        self.plot.draw();
      }
      var newHighlighting = false;
      var minDist = Infinity;
      _.each(self.plot.getData(), function (series) {
        if (!series.channel || series.lines.fill) return;
        var labelSibling = $('.legendLabel > div[data-channel-name="'+
            series.channel.channelName+'"]', self.el);
        var labelParent = labelSibling.parent().parent();
        var label = $('.legendValue', labelParent);
        var valueHTML = '';
        if (time != null &&
            time >= series.xaxis.datamin && time <= series.xaxis.datamax) {
          var hp = _.detect(series.data, function(p, i) {
            var prev = series.data[i-1];
            return prev && p && prev[0] <= time && time < p[0] && p;
          });
          if (hp) {
            if (graph === self && mouse) {
              // Check for mouse near vertical lines
              // as well as horizontal lines.
              var dx = Infinity, dy = Infinity;
              var i = series.data.indexOf(hp);
              var hpxc = series.xaxis.p2c(hp[0]);
              var hpyc = series.yaxis.p2c(hp[1]);
              if (series.data.length > 1 &&
                  i > 0 && i < series.data.length - 2) {
                var hpl = series.data[i - 1];
                var hpr = series.data[i + 1];
                if (hpr) {
                  var hplxc = series.xaxis.p2c(hpl[0]);
                  var hplyc = series.yaxis.p2c(hpl[1]);
                  var hpryc = series.yaxis.p2c(hpr[1]);
                  var dxl = mouse.x - hplxc;
                  var dxr = hpxc - mouse.x;
                  if ((mouse.y > hpyc && mouse.y < hpryc) ||
                      (mouse.y > hpryc && mouse.y < hpyc)) {
                    dx = dxr;
                  } else if (i > 2) {
                    var hpll = series.data[i - 2];
                    if (hpll) {
                      var hpllyc = series.yaxis.p2c(hpll[1]);                  
                      var goingUp = hp[1] < hpr[1];
                      if ((goingUp && mouse.y > hplyc &&
                          mouse.y < hpllyc) ||
                          (!goingUp && mouse.y < hplyc &&
                          mouse.y > hpllyc)) {
                        dx = dxl;
                      }
                    }
                  }
                }
              }
              dy = Math.abs(hpyc - mouse.y);
              var d = Math.min(dx, dy);
              if (d <= minDist && d <= self.minHoverDistance) {
                minDist = d;
                newHighlighting = series.channel.channelName;
              }
            }
            var v = hp[1];
            if (Math.abs(Math.round(v)) >= 1e6)
              v = v.toFixed(0);
            else {
              // Limit to 6 digits of precision (converting very small numbers
              // to e.g. '1.23400e-8'), strip zeros trailing the decimal
              // point, and strip the decimal point itself if necessary.
              // JavaScript number formatting sucks!
              v = v.toPrecision(6).
                  replace(/(\.[0-9]*?)0*([Ee][0-9-]*)?$/, '$1$2').
                  replace(/\.([Ee][0-9-]*)?$/, '$1');
            }
            valueHTML = self.addCommas(v);
          }
        }
        label.html(valueHTML);
      });
      if (mouse && newHighlighting !== self.highlighting) {
        if (self.highlightedLabel)
          self.highlightedLabel.removeClass('label-highlight');
        self.highlighting = newHighlighting;
        var labelSibling = $('.legendLabel > div[data-channel-name="'+
            self.highlighting+'"]', self.el);
        self.highlightedLabel = labelSibling.parent().parent();
        self.highlightedLabel.addClass('label-highlight');
        self.plot.getPlaceholder().css(
            { cursor: newHighlighting ? 'pointer' : 'crosshair' });
        self.updateSeriesColors(self.plot.getData());
        self.plot.draw();
      }
    },

    addYaxesBoundsForDrops: function () {
      var self = this;
      if (this.axisTargets) return;
      var parentPadding = {
        lr: Math.ceil((self.content.width() -
            self.plot.getPlaceholder().width()) / 2),
        tb: Math.ceil((self.content.height() -
            self.plot.getPlaceholder().height()) / 2),
      };
      _.each(self.plot.getAxes(), function (axis, key) {
        if (key === 'xaxis') return;
        var box = getBoundingBoxForAxis(axis);
        var borderLeft = key === 'yaxis' ?
            '' : '1px dashed rgba(0, 0, 0, 0.5)';
        var borderRight = key === 'y2axis' ?
            '' : '1px dashed rgba(0, 0, 0, 0.5)';
        $('<div>')
            .data({
              'axis.direction': axis.direction,
              'axis.n': axis.n,
              id: self.options.id,
              dragover: function () { $(this).css({ opacity: 1 }) },
              dragout: function () { $(this).css({ opacity: 0 }) },
            })
            .css({
              left: (axis.n - 1) * self.plot.width() / 2,
              top: 0,
              width: self.plot.width() / 2,
              height: box.height,
              'border-left': borderLeft,
              'border-right': borderRight,
            })
            .addClass('axisTarget')
            .addClass('jstree-drop')
            .appendTo(self.content);
      });

      self.axisTargets = $('.axisTarget', self.el);

      function getBoundingBoxForAxis (axis) {
        var left = axis.box.left,
            top = -parentPadding.tb,
            right = left + axis.box.width;
        var width = right - left,
            height = self.content.height() + 1;
        if (axis.position === 'left') {
          left -= parentPadding.lr + 1;
          width += parentPadding.lr;
        } else {
          width += parentPadding.lr;
        }
        return { left: left, top: top,
              width: width, height: height };
      }
    },

    removeYaxesBoundsForDrops: function () {
      if (!this.axisTargets) return;
      this.axisTargets.remove();
      this.axisTargets = null;
    },

    showNotification: function (range, other) {
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
    },

    fetchLatest: function (e, cb) {
      if (e) e.preventDefault();
      var self = this;
      App.sampleCache.refetchLatest(self.model.tabModel.treeModel,
                                    self.model.get('vehicleId'),
                                    function (newTimeRange) {
        //* Note: for testing only!
        // if (!newTimeRange) {
        //   newTimeRange = self.getVisibleTime();
        //   var rand = Math.random() * 10000000;
        //   newTimeRange.beg += rand;
        //   newTimeRange.end += rand;
        // }
        //*
        if (newTimeRange) {
          var prevTimeRange = self.getVisibleTime();
          var xaxis = self.plot.getXAxes()[0];
          pan(xaxis.p2c(newTimeRange.end/1e3)
                - xaxis.p2c(prevTimeRange.end/1e3), function () {
            if (cb) cb();
          });
          console.log('Got new data:', newTimeRange.beg, newTimeRange.end);
        } else if (cb) cb();
      });

      function pan(dest, cb) {
        var dur = 500, inc = 20;
        var pos = _.map(_.range(0, dur+inc, inc),
            function (time) {
          return App.easing.easeOutExpo(time, 0, dest, dur);
        });
        var len = pos.length;
        var steps = _.map(pos, function (p, i) {
          return i < len - 1 ? pos[i+1] - p : 0;
        });
        (function step(i) {
          if (i < len)
            _.delay(function () {
              self.plot.pan({ left: steps[i], top: 0 });
              step(++i);
            }, inc);
          else cb();
        })(0);
      }
    },

    followLatest: function (e) {
      e.preventDefault();
      var self = this;
      var freq = 10000;
      var button = $(e.target);
      if (button.hasClass('small-button-sticky-active')) {
        button.removeClass('small-button-sticky-active');
        this.following = false;
      } else {
        button.addClass('small-button-sticky-active');
        this.following = true;
        checkLatest();
      }

      function checkLatest() {
        if (self.following) {
          self.fetchLatest(null, function () {
            if (self.following)
              _.delay(checkLatest, freq);
          });
        }
      }
    },

    exportCsv: function (e) {
      var self = this;
      e.preventDefault();
      var channels = [
          { channelName: '$beginDate', title: 'Begin Date' },
          { channelName: '$beginTime', title: 'Begin Time' },
          { channelName: '$beginRelTime', title: 'Begin Since Start', units: 's' },
          { channelName: '$endRelTime', title: 'End Since Start', units: 's' },
        ].concat(self.model.get('channels'));
      App.engine('export_csv.dialog.jade',
          { channels: channels }).appendTo(self.el).modal({
        appendTo: self.el,
        overlayId: 'osx-overlay',
        containerId: 'osx-container',
        closeHTML: null,
        minHeight: 80,
        opacity: 65,
        position: ['0',],
        overlayClose: true,
        onOpen: function (d) {
          var self = this;
          self.container = d.container[0];
          d.overlay.fadeIn('fast', function () {
            $('#osx-modal-content', self.container).show();
            var title = $('#osx-modal-title', self.container);
            title.show();
            d.container.slideDown('fast', function () {
              setTimeout(function () {
                var h = $('#osx-modal-data', self.container).height() +
                    title.height() + 20;
                d.container.animate({ height: h }, 200, function () {
                  $('div.close', self.container).show();
                  $('#osx-modal-data', self.container).show();
                });
              }, 300);
            });
          });
        },
        onClose: function (d) {
          var self = this;
          d.container.animate({ top:'-' + (d.container.height() + 20) }, 300,
              function () {
            self.close();
            $('#osx-modal-content').remove();
          });
        },
      });
      $('[value="noResample"]').attr('checked', true);
      $('[name="minmax"]').attr('disabled', true);
      $('[name="sampleType"]').click(onSampleTypeClick);
      function onSampleTypeClick(e) {
        $('[name="minmax"]').get(0).disabled =
            $('[value="noResample"]').is(':checked');
        checkExportOk();
      }
      function checkExportOk() {
        var resampling = $('[value="resample"]').is(':checked');
        var viewRange = self.getVisibleTime();
        var resampleTime = Math.round(Number($('#resample').val()) * 1e6);
        var exportCount =
            Math.ceil((viewRange.end - viewRange.beg) / resampleTime);
        var maxCount = 100000;
        if (resampling && !(exportCount <= maxCount)) {
          $('#rowCount').text(self.addCommas(exportCount));
          $('#rowMax').text(self.addCommas(maxCount));
          $('#exportError').css('visibility', 'visible');
          $('#download-data').addClass('disabled');
          return false;
        } else {
          $('#exportError').css('visibility', 'hidden');
          $('#download-data').removeClass('disabled');
          return true;
        }
      }
      $('#resample').focus(onResampleTextClick).click(onResampleTextClick).
          keyup(checkExportOk).change(checkExportOk);
      function onResampleTextClick(e) {
        $('[value="resample"]').click();
        onSampleTypeClick();
      }
      $('#download-data').click(function (e) {
        if (!checkExportOk()) return;
        var viewRange = self.getVisibleTime();
        var resample = !$('[value="noResample"]').is(':checked');
        var minmax = $('[name="minmax"]').is(':checked');
        var resampleTime = $('#resample').val();
        // TODO: calculate how many data points we'll generate with a resample,
        // and give some kind of warning or something if it's ridiculous.
        // TODO: maybe use the new download attribute on an anchor element?
        // http://html5-demos.appspot.com/static/a.download.html
        // We should really fetch the data via dnode then force the download
        // client-side... this way we can show a loading icon while the
        // user waits for the server to package everything up.
        var href = '/export/' +
            self.model.get('vehicleId') + '/data.csv' +
            '?beg=' + Math.floor(viewRange.beg) +
            '&end=' + Math.ceil(viewRange.end) +
            (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
            (resample && minmax ? '&minmax' : '') +
            channels.map(function(c){return '&chan=' + c.channelName}).join('');
        window.location.href = href;
      });
      return self;
    },

    enterLegend: function (e) {
      var row = $(e.target).closest('tr');
      var channelName = $('[data-channel-name]', row)
          .attr('data-channel-name');
      if (channelName === this.highlighting) return;
      this.highlighting = channelName;
      this.draw();
    },

    leaveLegend: function (e) {
      var receiver = document.elementFromPoint(e.clientX, e.clientY);
      if (!receiver) return;
      if (receiver.nodeType == 3) // Opera
        receiver = receiver.parentNode;
      if ($('[data-channel-name]', $(receiver).closest('tr')).length > 0)
        return;
      this.highlighting = false;
      this.draw();
    },

    ensureLegend: function () {
      this.ensureLegendRedraw = true;
    },

    removeChannel: function (e) {
      var labelParent = $(e.target).parent().parent();
      var label = $('.legendLabel > div', labelParent);
      var channel = JSON.parse(label.attr('data-channel'));
      this.highlighting = false;
      App.publish('ChannelUnrequested-' + 
          this.options.tabId + '-' + this.options.id, [channel]);
    },

    addGraph: function (e) {
      App.publish('GraphRequested-' + this.options.tabId, [App.util.makeId()]);
    },

    removeGraph: function (e) {
      _.each(this.model.get('channels'), _.bind(function (channel) {
        App.publish('ChannelUnrequested-' + 
            this.options.tabId + '-' + this.options.id, [channel]);
      }, this));
      App.publish('GraphUnrequested-' + this.options.tabId, [this.options.id]);
    },

    getMouse: function (e, plot) {
      return {
        x: e.pageX - parseInt(plot.offset().left),
        y: e.pageY - parseInt(plot.offset().top),
      };
    },

    // Note handling.

    beginNote: function (e, plot) {
      this.noteCanvas.show();
      if (this.noteBox) this.clearNote();
      this.noteBox = {
        x: this.getMouse(e, plot).x,
        y: 0,
        w: 0,
        h: plot.getPlaceholder().height(),
      };
    },

    drawNote: function (e, plot) {
      this.noteCtx.fillStyle = 'rgba(0,0,0,0.25)';
      this.clearNote();
      this.noteBox.w = this.getMouse(e, plot).x - this.noteBox.x;
      this.noteCtx.fillRect(this.noteBox.x, this.noteBox.y,
                            this.noteBox.w, this.noteBox.h);
    },

    endNote: function (e, plot) {
      var self = this;
      var mouse = self.getMouse(e, plot);

      var onRight, leftEdge, rightEdge;
      if (mouse.x < self.noteBox.x) {
        onRight = $(document).width() - 320 > e.pageX - self.noteBox.w;
        leftEdge = mouse.x;
        rightEdge = self.noteBox.x;
      } else {
        onRight = $(document).width() - 320 > e.pageX;
        leftEdge = self.noteBox.x;
        rightEdge = mouse.x;
      }

      var xaxis = plot.getXAxes()[0];
      var beg = xaxis.c2p(leftEdge);
      var end = xaxis.c2p(rightEdge);

      self.noteChannels = 
          _.pluck(self.model.get('channels'), 'channelName');

      self.note = self.getNote({
        top: mouse.y + 3,
        left: onRight ? rightEdge + 15 : leftEdge - 315,
      }, {
        time: App.util.toLocaleString(new Date(Math.round(beg)),
                                      'dddd m/d/yy h:MM:ss TT Z'),
        onRight: onRight,
        channels: self.noteChannels,
      }).hide().appendTo(self.el).fadeIn(200);

      var body = $('.note-text', self.note);
      var msg = $('.note-message', self.note);
      var loading = $('.note-loading', self.note);
      var spinner = new Spinner({
        lines: 8,
        length: 0,
        width: 2,
        radius: 8,
        color: 'yellow',
        speed: 1,
        trail: 60,
        shadow: false,
      });
      spinner.spin(loading.get(0));

      // textarea
      $('.note-text', this.note).placeholder().autogrow().focus()
          .bind('keyup', function (e) {
        if (!msg.is(':visible')) return;
        var val = body.val().trim();
        if (val !== '' && val !== body.attr('data-placeholder'))
          msg.hide();
      });

      // post button
      $('.note-post', self.note).bind('click', function (e) {
        msg.hide();
        var val = body.val().trim();
        if (val === '' || val === body.attr('data-placeholder')) {
          msg.text('Please enter text first.').show();
          return;
        }
        loading.show();
        var note = {
          beg: beg * 1e3,
          end: end * 1e3,
          val: {
            text: $('.note-text', self.note).val(),
            user_id: App.store.get('user').id,
            date: new Date().getTime(),
            channels: self.noteChannels,
          },
        };
        App.api.insertSamples(self.model.get('vehicleId'),
                              { _note: [ note ] }, function (err) {
          if (!err) {
            msg.text('Your comment has been posted.').show();
            loading.hide();
            _.delay(function () {
              self.cancelNote(null, plot, true);
            }, 1e3);
            $('.timeline-icon', self.holder).remove();
            self.model.tabModel.resetNotifications();
          } else throw new Error(err);
        });
      });

      // cancel anchor
      $('.note-cancel', self.note).bind('click', function (e) {
        self.cancelNote(null, plot);
      });

      // remove channel x's
      $('.note-channel-remove', self.note).bind('click',
          _.bind(self.removeNoteChannel, self));

    },

    addNoteChannelFromLabel: function (e) {
      var self = this;
      if (!self.noteBox) return;
      var noteChannelsList = $('.note-channels > ul', self.note);
      var channelName = 
          $(e.target).closest('[data-channel-name]').data('channel-name');
      if (!channelName) return;
      if (_.find(self.noteChannels, function (channel) { 
          return channel === channelName; })) return;
      $('<li>')
          .html(channelName + '&nbsp;<a class="note-channel-remove"' +
                'href="javascript:;" title="Remove channel">&nbsp;(X)</a>')
          .addClass('note-channel')
          .data('channel-name', channelName)
          .appendTo(noteChannelsList)
          .bind('click', _.bind(self.removeNoteChannel, self));
      self.noteChannels.push(channelName);
    },

    removeNoteChannel: function (e) {
      var li = $(e.target).closest('li');
      this.noteChannels = _.reject(this.noteChannels, function (channel) {
        return channel === li.data('channel-name');
      });
      li.remove();
    },

    cancelNote: function (e, plot, fade) {
      if (this.note) {
        if (fade)
          this.note.fadeOut(200, function () {
            $('.note-text', this).remove();
            $(this).remove();
          });
        else {
          $('.note-text', this.note).remove();
          this.note.remove();
        }
        this.note = null;
      }
      this.noteCanvas.hide();
      this.clearNote();
      this.noteBox = null;
    },

    clearNote: function () {
      if (!this.noteBox) return;
      this.noteCtx.clearRect(this.noteBox.x, this.noteBox.y,
                            this.noteBox.w, this.noteBox.h);
    },

    redrawNote: function () {
      
    },

    getNote: function (pos, opts) {
      opts = opts || {};
      _.defaults(opts, {
        isNew: true,
        notes: [],
        channels: [],
        time: Date(),
        onRight: true,
      });
      return App.engine('note.jade', opts)
          .css({ top: pos.top, left: pos.left });
    },

  });
});

