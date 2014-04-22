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

      // Some graph constants
      this.POINTS_TO_SHOW = 250; // maximum number of points to display
      this.PIXELS_FROM_HIGHLIGHT = 40; // maximum number of pixels for line highlight

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('chart/zoom', _.bind(this.zoom, this)),
        mps.subscribe('graph/draw', _.bind(function() {
          this.model.updateCacheSubscription();
          this.draw();
        }, this)),
        mps.subscribe('channel/lineStyleUpdate',
              _.bind(function (channel, opts, save) {
          this.model.setUserLineStyle(channel, opts, save);
        }, this)),
      ];
    },

    // Draw template.
    render: function () {

      // Init a model for this view.
      var time;
      if (store.get('state').time)
        time = store.get('state').time;
      else if (this.app.profile.content.datasets 
          && this.app.profile.content.datasets.items.length > 0) {
        time = this.app.profile.content.datasets.items[0].meta;
      } else
        time = {
          beg: (Date.now() - 7*24*60*60*1e3) * 1e3,
          end: Date.now() * 1e3,
        };
      this.model = new Graph(this.app, {view: this, time: time});

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.graphs');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

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

      this.lightened = {};

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
        // height = Math.max(height, 300);
        this.plot.setCanvasDimensions(width, height);
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    zoom: function (range) {
      if (!range) return;
      var xaxis = this.plot.getXAxes()[0];
      if (_.isNumber(range)) {
        range *= 1e3;
        var avg = (xaxis.options.max + xaxis.options.min) / 2;
        xaxis.options.min = avg - range / 2;
        xaxis.options.max = avg + range / 2;
      } else if (_.isObject(range)) {
        if (range.center) {
          var delta = xaxis.options.max - xaxis.options.min;
          xaxis.options.min = range.center - delta / 2;
          xaxis.options.max = range.center + delta / 2;
        } else {
          xaxis.options.min = range.min;
          xaxis.options.max = range.max;
        }
      }
      this.plot.setupGrid();
      this.plot.draw();
      this.plot.getPlaceholder().trigger('plotzoom', [this.plot]);
    },

    // returns an array of objects containing {
    //   channelName: name of series to cursor
    //   channelIndex:
    //   nearestPointData: x,y of the nearest point
    //   nearestPointIndex: series index for nearest point
    //   pixelsFromNearestPt: distance of mouse from the nearest point
    //   pixelsFromInterpPt: distance of mouse from an interpolated line
    getStatsNearMouse: function (e) {
      var mouse = this.getMouse(e);
      var xaxis = this.plot.getXAxes()[0];
      var time = xaxis.c2p(mouse.x);
      var points = {};

      var lastDataSet = null;

      // stored remapping of series (x,y) points as array of x points
      var series_x = [];

      // stored index of the next point in the series relative to the cursor
      var timeIdxHigh;

      // Return an array of interesting data about the series, removing nulls
      return _.compact(_.map(this.plot.getData(), _.bind(function (series, idx) {

        // object to return
        var obj = {
          channelName: series.channelName,
          channelIndex: idx,
          nearestPointData: null,
          nearestPointIndex: null,
          pixelsFromNearestPt: null,
          pixelsFromInterpPt: null,
          //interpPt: null,
        };

        // the first data point of a series is null.  This function
        // only works on series data that has at least two valid points
        if (series.data.length < 3) return null;

        // Excluse empty and min-max series.
        if (!series.channelName || series.channelName.indexOf('minmax') != -1) return null;

        // Ensure series is valid for the time.
        if (time === null) return null;

        // If this is the same dataset as the last series, we don't
        // need to run the below search again
        var dataset = this.model.findDatasetFromChannel(series.channelName);
        if (dataset !== lastDataSet) {
          // get the x coordinates of the series as an array
          series_x = (_.map(series.data, function (d) { return d ? d[0] : null; }));

          // use binary search to locate time in the array
          timeIdxHigh = (_.sortedIndex(series_x, time, null, this))
        }

        // Bound edges.  This should just work, but will make invalid results
        // for pixelsFromInterpPt and interpPt
        if (timeIdxHigh < 2) {
          timeIdxHigh = 2;
        } else if (timeIdxHigh >= series.data.length) {
          timeIdxHigh = series.data.length - 1;
        }
        var timeIdxLow = timeIdxHigh - 1;

        // coordinates of series values
        var cTimeLow = series.xaxis.p2c(series.data[timeIdxLow][0]);
        var cTimeHigh = series.xaxis.p2c(series.data[timeIdxHigh][0]);
        var cValueLow = series.yaxis.p2c(series.data[timeIdxLow][1]);
        var cValueHigh = series.yaxis.p2c(series.data[timeIdxHigh][1]);

        // linear interpolation
        var interp = function (x0, x1, y0, y1, x) {
          var s = (y1 - y0) / (x1 - x0);
          return (x - x0)*s + y0;
        };

        /*  not sure if useful
        obj.interpPt = interp(
          series.data[timeIdxLow][0], series.data[timeIdxHigh][0],
          series.data[timeIdxLow][1], series.data[timeIdxHigh][1], time
        );
        */

        // if the cursor is between two points, determine if its closer
        // to the right or left point
        var cNearestPt = []
        if ((cTimeHigh - cTimeLow) > (mouse.x  - cTimeLow)*2) {
          obj.nearestPointData = series.data[timeIdxLow];
          obj.nearestPointIndex = timeIdxLow;
          cNearestPt.push(cTimeLow);
          cNearestPt.push(cValueLow);
        }
        else {
          obj.nearestPointData = series.data[timeIdxHigh];
          obj.nearestPointIndex = timeIdxHigh;
          cNearestPt.push(cTimeHigh);
          cNearestPt.push(cValueHigh);
        }

        var x0 = mouse.x - cNearestPt[0];  var y0 = mouse.y - cNearestPt[1];
        // vector magnitude of distance to pixels
        obj.pixelsFromNearestPt = Math.sqrt(x0*x0+y0*y0);

        var interpValue = interp(cTimeLow, cTimeHigh, cValueLow, cValueHigh, mouse.x);
        obj.pixelsFromInterpPt = Math.abs(mouse.y - interpValue);
        return obj;

      }, this)));
    },

    // TODO: Change this function to use getStatsNearMouse and make the cursor display!
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

      function rangeFitsAxis(range, axis) {
        if (range.min === Infinity || range.max === -Infinity)
          return false;
        if (axis.min === Infinity || axis.max === -Infinity)
          return false;
        if (range.min / 10 > axis.max || range.max * 10 < axis.min)
          return false;
        else return true;
      }

      // Create the graph if first run.
      if (!this.plot) this.create();

      // Save ref to channels.
      var channels = this.model.getChannels();

      // Use and empty channel if no channels.
      if (channels.length === 0) {
        channels.push({channelName: 'empty'});
        this.model.lineStyleOptions['empty'] = this.model.DEFAULT_LINE_STYLE;
        _.each(this.plot.getYAxes(),
            function (a) { a.options.show = false; });
      } else {
        _.each(this.plot.getYAxes(),
            function (a) { a.options.show = null; });
      }

      // Draw each series (channel).
      var series = [];
      var yaxes = [{min: Infinity, max: -Infinity, cnt: 0},
          {min: Infinity, max: -Infinity, cnt: 0}];
      _.each(channels, _.bind(function (channel, i) {
        var lineStyleOpts = this.model.lineStyleOptions[channel.channelName]
        var highlighted = this.highlightedChannel === channel.channelName;

        // Setup series.
        var seriesBase = {
          xaxis: 1,
          yaxis: lineStyleOpts.yaxis,
          channelIndex: i,
        };
        var data = this.getSeriesData(channel);
        series.push(_.extend({
          points: {
            show: false,
          },
          lines: {
            show: false,
            lineWidth: 2,
            fill: false,
          },
          data: data.data,
          channelName: channel.channelName,
          label: channel.title,
        }, seriesBase));

        // minMax view hacks
        // count number of nulls in the data, don't show if too many
        // don't show minMax if a fill plot is on
        numNulls = _.foldl(data.minMax, function(memo, it) {
          return memo + (it === null ? 1 : 0);
        }, 0);

        var showMinMax = numNulls < data.minMax.length * .33;

        if (data.minMax.length > 0 && showMinMax) {
          series.push(_.extend({
            points: {
              show: false
            },
            lines: {
              show: true,
              lineWidth: 0,
              fill: 0.3,
            },
            channelName: channel.channelName + '__minmax',
            data: data.minMax,
          }, seriesBase));
        }
      }, this));
      this.updateSeriesColors(series);
      this.plot.setData(series);
      this.plot.setupGrid();
      this.updateGraphLineStyle();
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
            return span < 10000 ?
              util.toLocaleString(date, 'h:MM:ss.L TT') :
              span < 86400000 ?
              util.toLocaleString(date, 'h:MM:ss TT') :
              util.toLocaleString(date, 'm/d/yyyy');
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
          {position: 'left', alignTicksWithAxis: 1},
          {position: 'right'}
        ],
        series: {
          lines: {
            lineWidth: 2
          },
          points: {
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
          interactive: false,
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
        }, this))

        .mousemove(_.bind(function (e) {
          // panning behavior, unless we're highlight on a line.
          if (this.mousedown) {
            if (this.changingOffset) {
              this.endOffset(e);
              return;
            } else {
              this.plot.pan({ left: this.prevPageX - e.pageX});
              this.prevPageX = e.pageX;
            }
          }
          if (!this.lastMouseMove) this.lastMouseMove = 0;
          // don't run this very frequently, perhaps once every 20ms
          if (Date.now() - this.lastMouseMove > 20) {
            this.lastMouseMove = Date.now();
            var stats = this.getStatsNearMouse(e);
            this.mouseLineStyle(e, stats);
            mps.publish('channel/mousemove', [stats]);
          }
        }, this))

        .mousedown(_.bind(function (e) {
          this.plot.unhighlight();
          var closestChannel =
            _.sortBy(this.getStatsNearMouse(e), 'pixelsFromInterpPt')[0];
          if (!closestChannel) return;
          
          // FIXME: Allow dataset offsetting with some key combo
          // (harder to do accidentally)
          /*
          if (closestChannel.pixelsFromInterpPt < this.PIXELS_FROM_HIGHLIGHT) {
            this.beginOffset(e);
            this.changingOffset = true;
          }
          */

          this.mousedown = true;
          this.prevPageX = e.pageX;
        }, this))

        .mouseup(_.bind(function (e) {
          if (this.channelForOffset) {
            var did = this.model.findDatasetFromChannel(this.channelForOffset).get('id');
            this.lightened[did] = false;
            delete this.channelForOffset;
          }
          if (this.changingOffset)
            this.draw();
          this.mousedown = false;
          this.changingOffset = false;
        }, this));

        function graphZoomClick(e, factor, out) {
          this.plot.unhighlight();
          var c = this.plot.offset();
          c.left = e.originalEvent.pageX - c.left;
          c.top = e.originalEvent.pageY - c.top;
          if (out)
            this.plot.zoomOut({center: c, amount: factor});
          else
            this.plot.zoom({center: c, amount: factor});
          this.draw();
        }
      }

      function weekendAreas(axes) {
        var markings = [];
        // don't try to paint more than (experimentally) 70 markings
        if (axes.xaxis.max - axes.xaxis.min > 7*24*60*60*1000*70)
          return markings;
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

    beginOffset: function(e) {
      var mouse = this.getMouse(e);
      var xaxis = this.plot.getXAxes()[0];

      this.channelForOffset =
        _.sortBy(this.getStatsNearMouse(e), 'pixelsFromInterpPt')[0].channelName

      var plotData = this.plot.getData();
      var c = _.find(plotData, function(f) {
        return plotData.channelName === this.channelForOffset;
      });
      var did = this.model.findDatasetFromChannel(this.channelForOffset).get('id');
      this.lightened[did] = true;
      this.plot.setData(plotData);

      this.offsetTimeBegin = xaxis.c2p(mouse.x) * 1000;
    },

    endOffset: function(e) {
      // get the desired time offset
      var mouse = this.getMouse(e);
      var xaxis = this.plot.getXAxes()[0];

      var offsetTimeEnd = xaxis.c2p(mouse.x) * 1000;
      var offset = (xaxis.c2p(mouse.x) * 1000 - this.offsetTimeBegin);
      this.offsetTimeBegin = offsetTimeEnd;

      var newOffset = this.model.getDatasetOffset(this.channelForOffset) + offset;

      // update the dataset model
      this.model.setDatasetOffset(this.channelForOffset, newOffset);
      mps.publish('graph/offsetChanged', []);
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
        this.trigger('VisibleWidthChange');
        this.prevWidth = t.width;
      }
      mps.publish('graph/drawComplete', [t]);
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
      var data = [];
      var minMax = [];
      var samples = [];
      var offset = 0;
      if (this.model.sampleCollection[channel.channelName]) {
        samples = this.model.sampleCollection[channel.channelName].sampleSet;
        offset = this.model.sampleCollection[channel.channelName].offset;
      }
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s, i) {
        if (prevEnd != s.beg)
          data.push(null);
        var val = s.val * conv.factor + conv.offset;
        data.push([(s.beg + offset) / 1000, val]);
        var lineStyleOpts = this.model.lineStyleOptions[channel.channelName];
        if (lineStyleOpts.interpolation === 'none') {
          if (s.end !== s.beg)
            data.push([(s.end + offset) / 1000, val]);
        }
        prevEnd = s.end;
        if (s.min != null || s.max != null) {
          if (prevMinMaxEnd != s.beg)
            minMax.push(null);
          var max = s.max == null ? val : s.max * conv.factor + conv.offset;
          var min = s.min == null ? val : s.min * conv.factor + conv.offset;
          minMax.push([s.beg / 1000, max, min]);
          if (lineStyleOpts.interpolation === 'none') {
            if (s.end !== s.beg)
              minMax.push([s.end / 1000, max, min]);
          }
          prevMinMaxEnd = s.end;
        }
      }, this);
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
      yAxes[0].options.color = '#666';
      yAxes[1].options.color = '#666';
      //yAxes[1].options.color = '#d0d0d0';
      series.forEach(_.bind(function (s, i) {
        var channel = channels[s.channelIndex];
        var highlighted = this.highlightedChannel === channel.channelName;
        var color;
        if (this.model.lineStyleOptions[channel.channelName].color)
          var color = this.model.lineStyleOptions[channel.channelName].color;
        else {
          var color = this.app.getColors(channel.colorNum);
          this.model.lineStyleOptions[channel.channelName].color = this.color;
        }

        s.originalColor = color;

        var did = this.model.findDatasetFromChannel(channel.channelName).get('id');
        if (this.lightened[did] === true)
          color = util.lightenColor(color, .3);
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
      }, this));
    },

    updateGraphLineStyle: function() {
      var plotData = this.plot.getData();
      var opts = this.plot.getOptions();
      var numPoints = this.getVisiblePoints();
      var needsUpdate = false;

      _.each(plotData, function(series, idx) {

        if (series.channelName.indexOf('__minmax') != -1)
          return;
        var lineStyleOpts = this.model.lineStyleOptions[series.channelName];

        // copy over some series data
        var oldPoints = {}, oldLines = {};
        _.extend(oldPoints, series.points);
        _.extend(oldLines, series.lines);

        // don't display line series points if we have a lot of data
        series.points.show = ((numPoints[idx] < this.POINTS_TO_SHOW)
                          || !lineStyleOpts.showLines)
                          && lineStyleOpts.showPoints;

        series.lines.show = lineStyleOpts.showLines;
        series.lines.lineWidth = lineStyleOpts.lineWidth;
        series.points.radius = lineStyleOpts.pointRadius;
        series.lines.fill = lineStyleOpts.showArea;

        // compare seriesect properties and decide whether we ned to redraw
        if (JSON.stringify(series.lines) !== JSON.stringify(oldLines)
            || JSON.stringify(series.points) !== JSON.stringify(oldPoints))
            needsUpdate = true;
      }, this);

      if (needsUpdate) {
        this.plot.setData(plotData);
      }
    },

    // if mouse is near cursor, bold it
    mouseLineStyle: function(e, stats) {
      var plotData = this.plot.getData();
      var opts = this.plot.getOptions();
      // lookup closest channel to mouse cursor
      var closestChannel =
        _.sortBy(stats, 'pixelsFromInterpPt')[0];
      if (!closestChannel) return;
      var lineStyleOpts = this.model.lineStyleOptions[closestChannel.channelName];

      var series =  _.find(plotData, function (obj) {
        return obj.channelName === closestChannel.channelName;
      });

      this.plot.unhighlight();

      var needsUpdate = false;
      _.each(plotData, function (obj) {
        // minmax plots have the same line-style
        if (obj.channelName.indexOf('__minmax') != -1)
          return;
        var lso = this.model.lineStyleOptions[obj.channelName.split('__minmax')[0]];
        needsUpdate = needsUpdate | (obj.lines.lineWidth !== lso.lineWidth)
        obj.lines.lineWidth = lso.lineWidth;
        obj.points.radius = lso.pointRadius;
      }, this);

      var curWidth = series.lines.lineWidth;
      var newWidth = lineStyleOpts.lineWidth;
      var newRadius = lineStyleOpts.pointRadius;
      if (closestChannel.pixelsFromInterpPt < this.PIXELS_FROM_HIGHLIGHT) {
        newWidth = newWidth + 2;
        newRadius = newRadius + 1;
        this.plot.highlight(closestChannel.channelIndex, closestChannel.nearestPointIndex);
      }

      if (newWidth != curWidth) {
        needsUpdate = true;
        series.lines.lineWidth = newWidth;
        series.points.radius = newRadius;
      }

      if (needsUpdate) {
        this.plot.setData(plotData);
        this.plot.draw();
      }
    },

    // returns an array of number of datapoints visible in displayed graph
    // per timeseries data
    getVisiblePoints: function() {
      var plotData = this.plot.getData();
      var visTime = _.map(this.getVisibleTime(), function(a) { return a/1e3; });
      return _.map(plotData, function(obj) {
        var i = 1;
        for (;i < obj.data.length; i++)
          if (obj.data[i] !== null && obj.data[i][0] >= visTime[0]) break;
        var startIdx = i;
        for (;i < obj.data.length; i++)
          if (obj.data[i] !== null && obj.data[i][0] >= visTime[1]) break;
        var endIdx = i;
        return (endIdx - startIdx);
      });
    },

  });
});

