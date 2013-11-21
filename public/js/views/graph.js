/*
 * Graph view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'models/graph',
  'text!../../templates/graph.html',
  'flot_plugins'
], function ($, _, Backbone, mps, util, units, Graph, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'graph',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('chart/zoom', _.bind(this.zoom, this)),
      ];
    },

    // Draw template.
    render: function () {

      // Init a model for this view.
      this.model = new Graph(this.app, this);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.graphs');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #exportChart': 'exportCsv'
    },

    // Misc. setup.
    setup: function () {

      // Save refs
      this.plot = null;

      // Draw the canvas.
      this.draw();

      // Do resize on window change.
      this.$el.hide();
      _.delay(_.bind(function () {
        this.resize();
        this.$el.show();
      }, this), 250);
      _.delay(_.bind(function () { this.resize(); }, this), 500);
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      $(window).resize(_.debounce(_.bind(this.resize, this), 150));
      $(window).resize(_.debounce(_.bind(this.resize, this), 300));

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.plot.getPlaceholder().remove();
      this.plot = null;
      this.remove();
    },

    resize: function (e, w, h) {
      if (this.plot) {
        var width = w || this.$el.parent().width();
        var height = h || this.$el.parent().height();
        height = Math.max(height, 300);
        this.plot.setCanvasDimensions(width, height);
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    zoom: function (range) {
      if (!range) return;
      range *= 1e3;
      var xaxis = this.plot.getXAxes()[0];
      var avg = (xaxis.options.max + xaxis.options.min) / 2;
      xaxis.options.min = avg - range / 2;
      xaxis.options.max = avg + range / 2;
      this.plot.setupGrid();
      this.plot.draw();
      this.plot.getPlaceholder().trigger('plotzoom', [this.plot]);
    },

    cursor: function (e) {
      var mouse = this.getMouse(e);
      var xaxis = this.plot.getXAxes()[0];
      var time = xaxis.c2p(mouse.x);
      var points = {};
      var x, t;

      // Find the closest point for each series.
      _.each(this.plot.getData(), _.bind(function (series) {

        // Excluse empty and min-max series.
        if (!series.channelName || series.lines.fill) return;

        // Ensure series is valid for the time.
        if (time === null) return;

        // Find the point.
        var point;
        var first = series.data[1];
        var last = series.data[series.data.length - 1];
        if (first && time < first[0]) point = first;
        else if (last && time > last[0]) point = last;
        else {
          var i; point = _.find(series.data, function (p, _i) {
            var prev = series.data[_i - 1]; i = _i;
            return prev && p && prev[0] <= time && time < p[0];
          });
          if (point) {
            var prev = series.data[i - 1];
            if (time - prev[0] < point[0] - time)
              point = prev;
          }
        }
        if (!point) return;

        // Convert point time to x-coordinate.
        var _x = series.xaxis.p2c(point[0]);
        if (!x || Math.abs(mouse.x - _x) < Math.abs(mouse.x - x)) {
          x = _x;
          t = point[0];
        }

        // Format point value.
        var v = point[1];
        if (Math.abs(Math.round(v)) >= 1e6) v = v.toFixed(0);
        else {

          // Limit to 6 digits of precision (converting very small numbers
          // to e.g. '1.23400e-8'), strip zeros trailing the decimal
          // point, and strip the decimal point itself if necessary.
          v = v.toPrecision(6).
              replace(/(\.[0-9]*?)0*([Ee][0-9-]*)?$/, '$1$2').
              replace(/\.([Ee][0-9-]*)?$/, '$1');
        }

        // Add series to map.
        points[series.channelName] = [point[0], util.addCommas(v)];
      }, this));

      return {x: x, t: t, points: points};
    },

    draw: function () {
      if (!this.plot) this.create();

      var channels = [];
      _.each(this.model.getChannels(), function (c) {
        channels.push($.extend(true, {}, c));
      });

      if (channels.length === 0) {
        channels.push({ channelName: 'empty' });
        _.each(this.plot.getYAxes(),
              function (a) { a.options.show = false; });
      } else {
        _.each(this.plot.getYAxes(),
              function (a) { a.options.show = null; });
      }

      var opts = this.plot.getOptions();
      var series = [];
      _.each(channels, _.bind(function (channel, i) {
        var highlighted = this.highlightedChannel === channel.channelName;
        var seriesBase = {
          xaxis: 1,
          yaxis: channel.yaxisNum,
          channelIndex: i,
          channelName: channel.channelName,
        };
        var data = this.getSeriesData(channel);
        series.push(_.extend({
          lines: {
            show: true,
            lineWidth: 2,
            fill: false,
          },
          data: data.data,
          label: channel.title,
        }, seriesBase));
        if (data.minMax.length > 0) {
          series.push(_.extend({
            lines: {
              show: true,
              lineWidth: 0,
              fill: 0.6,
            },
            data: data.minMax,
          }, seriesBase));
        }
      }, this));
      this.updateSeriesColors(series);
      this.plot.setData(series);
      this.plot.setupGrid();
      this.plot.draw();
    },

    create: function () {
      this.plot = $.plot(this.$el, [], {
        xaxis: {
          mode: 'time',
          utc: true,
          twelveHourClock: true,
          position: 'bottom',
          min: this.model.get('visibleTime').beg / 1e3,
          max: this.model.get('visibleTime').end / 1e3,
          tickColor: 'rgba(0,0,0,0.1)',
          tickFormatter: _.bind(function (val, axis) {
            var visible = this.getVisibleTime();
            var span = (visible.end - visible.beg) / 1e3;
            var date = new Date(val);
            return span < 86400000 ?
              util.toLocaleString(date, 'h:MM:ss TT') :
              util.toLocaleString(date, 'm/d/yy');
          }, this)
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 0,
          zoomRange: false,
          panRange: false,
          tickColor: 'rgba(0,0,0,0.05)',
          labelsInside: true,
        },
        yaxes: [
          { position: 'right' },
          { position: 'left', alignTicksWithAxis: 1 },
        ],
        series: {
          lines: {
            lineWidth: 2
          },
          points: {
            show: true,
            radius: 3,
            lineWidth: 1,
            symbol: 'circle'
          },
          bars: {}
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
        zoom: {
          interactive: false,
        },
        pan: {
          interactive: true,
          frameRate: 60,
          useShiftKey: true,
        },
        hooks: {
          draw: [_.bind(this.onDraw, this)],
          setupGrid: [_.bind(this.onDrawGrid, this)],
          bindEvents: [_.bind(onBindEvents, this)],
        },
        padding: {x: 0, y: 20}
      });

      function onBindEvents() {
        this.$el.mousewheel(_.bind(function (e) {
          var delta = e.originalEvent.wheelDelta || -e.originalEvent.detail;
          graphZoomClick.call(this, e, e.shiftKey ? 1.5 : 1.1, delta < 0);
          return false;
        }, this))
        .dblclick(_.bind(function (e) {
          graphZoomClick.call(this, e, e.shiftKey ? 8 : 2, e.altKey || e.metaKey);
        }, this));

        function graphZoomClick(e, factor, out) {
          var c = this.plot.offset();
          c.left = e.originalEvent.pageX - c.left;
          c.top = e.originalEvent.pageY - c.top;
          if (out)
            this.plot.zoomOut({center: c, amount: factor});
          else
            this.plot.zoom({center: c, amount: factor});
        }
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
            color: 'rgba(249,249,249,0.8)',
          });
          i += 7*24*60*60*1000;
        } while (i < axes.xaxis.max);
        return markings;
      }
    },

    onDraw: function () {
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        this.trigger('VisibleTimeChange', {beg: t.beg, end: t.end});
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
      if (t.width != this.prevWidth) {
        this.trigger('VisibleWidthChange', t.width);
        this.prevWidth = t.width;
      }
      mps.publish('graph/draw');
    },

    onDrawGrid: function () {
      if (!this.plot) return;
      var xopts = this.plot.getAxes().xaxis.options;
      var xmin = xopts.min, xmax = xopts.max;
      var yAxes = this.plot.getYAxes();

      // Automatically change Y-axis bounds based on visible data.
      yAxes.forEach(function (axis) {
        axis.datamin = Infinity;
        axis.datamax = -Infinity;
      });

      // TODO: this is ugly, and probably slow.
      this.plot.getData().forEach(function (series) {
        var max = series.yaxis.datamax, min = series.yaxis.datamin;
        var prevTime = null;
        series.data.forEach(function (p) {
          if (p && prevTime && p[0] >= xmin && prevTime <= xmax) {
            max = Math.max(max, p[1]);
            min = Math.min(min, p[2] == null ? p[1] : p[2]);
          }
          prevTime = p && p[0];
        });
        series.yaxis.datamax = max;
        series.yaxis.datamin = min;
      });
      yAxes.forEach(function (axis) {
        if (!(isFinite(axis.datamin) && isFinite(axis.datamax))) {
          axis.datamin = 0; axis.datamax = 1;
        } else if (axis.datamin == axis.datamax) {
          axis.datamin -= 0.5; axis.datamax += 0.5;
        }
      });
    },

    onUnitsChange: function (e) {
      var newUnits = e.target.value;
      var channelName = $(e.target.parentNode).attr('data-channel-name');
      var channels = this.model.getChannels();
      var series = this.plot.getData();
      for (var i = 0; i < series.length; ++i) {
        if (series[i].channelName === channelName) {
          var channel = channels[series[i].channelIndex];
          channel.displayUnits = newUnits;
          var data = this.getSeriesData(channel);
          series[i].data = data.data;
          if (series[i+1] &&
              series[i+1].channelName === channelName &&
              data.minMax.length > 0) {
            series[i+1].data = data.minMax;
          }
          break;
        }
      }
      this.plot.setData(series);
      this.plot.setupGrid();
      this.plot.draw();
    },

    getSeriesData: function (channel) {
      var conv = units.findConversion(channel.units,
          channel.displayUnits || channel.units);
      var samples = this.model.sampleSet[channel.channelName] || [];
      var data = [];
      var minMax = [];
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s, i) {
        if (prevEnd != s.beg)
          data.push(null);
        var val = s.val * conv.factor + conv.offset;
        data.push([s.beg / 1000, val]);
        // if (s.end !== s.beg)
        //   data.push([s.end / 1000, val]);
        prevEnd = s.end;
        if (s.min != null || s.max != null) {
          if (prevMinMaxEnd != s.beg)
            minMax.push(null);
          var max = s.max == null ? val : s.max * conv.factor + conv.offset;
          var min = s.min == null ? val : s.min * conv.factor + conv.offset;
          minMax.push([s.beg / 1000, max, min]);
          if (s.end !== s.beg)
            minMax.push([s.end / 1000, max, min]);
          prevMinMaxEnd = s.end;
        }
      });
      return { data: data, minMax: minMax };
    },

    getMouse: function (e) {
      return {
        x: e.pageX - parseInt(this.plot.offset().left),
        y: e.pageY - parseInt(this.plot.offset().top),
      };
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
      if (beg != xopts.min || end != xopts.max) {
        xopts.min = beg;
        xopts.max = end;
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    updateSeriesColors: function (series) {
      var channels = this.model.getChannels();
      if (channels.length === 0) return;
      var yAxes = this.plot.getYAxes();
      series.forEach(_.bind(function (s, i) {
        var channel = channels[s.channelIndex];
        var highlighted = this.highlightedChannel === channel.channelName;
        var color = this.app.colors[channel.colorNum];
        s.originalColor = color;
        if (this.highlightedChannel && !highlighted) {

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
        if (i < yAxes.length) {
          yAxes[i].options.color = color;
        }
      }, this));
    },

  });
});

