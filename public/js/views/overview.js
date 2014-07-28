/*
 * Overview view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'models/graph',
  'd3'
], function ($, _, Backbone, mps, util, units, Graph) {

  return Backbone.View.extend({

    el: '.overview',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;
      this.on('rendered', this.setup, this);

      this.subscriptions = [
        mps.subscribe('channel/lineStyleUpdate',
            _.bind(function (channel, opts) {
          this.model.setUserLineStyle(channel, opts);
        }, this)),
        mps.subscribe('graph/drawComplete', _.bind(function (visTime) {
          _.debounce(this.drawCurrentTimeOverlay(visTime), 250);
        }, this)),
      ];
    },

    render: function () {

      // Init a model for this view.
      this.model = new Graph(this.app, {view: this, silent: true});

      this.trigger('rendered');
      return this;
    },

    events: {
      'mouseenter': function() {
        this.cursor.fadeIn('fast');
      },
      'mousemove': _.debounce(function (e) {
        this.cursor.css({left: e.pageX});
        var date = this.getTime(e.pageX, this.$el.width());
        this.cursorDate.text(util.toLocaleString(new Date(date), 'mmm d, yyyy'));
      }, 5),
      'mouseleave': function() {
        this.cursor.fadeOut('fast');
      },
      'mousedown': 'overviewZoom'
    },

    setup: function () {

      // Safe refs.
      this.selection = this.$('.overview-selection');
      this.cursor = this.$('#cursor-wrap-end');
      this.cursorDate = $('#cursor-wrap-end .overview-cursor-date');
      this.cursorDate.mousedown(_.bind(this.overviewZoom, this));

      this.visTimePlot = $('<div class="overview-vis">').appendTo(this.$el);

      var path = d3.svg.area()
        .x(this.$el.width()/2)
        .y0(0)
        .y1(this.visTimePlot.height());

      d3.select(this.visTimePlot.get(0))
        .append('svg:svg')
        .attr('width', this.$el.width())
        .attr('height', this.visTimePlot.height())
        .append('svg:g')
        .append('svg:path')
        .attr('d', path([0, 0]));

      // Do resize on window change.
      $(window).resize(_.debounce(_.bind(this.draw, this), 40));

      // Show parent.
      _.delay(_.bind(function () {
        this.$el.css({opacity: 1});
      }, this), 500);

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    draw: function () {
      var time = this.getVisibleTime();
      var width = this.$el.width();

      // Make a plot for each channel.
      this.model.fetchGraphedChannels(_.bind(function (channels) {
        var min = [Number.MAX_VALUE, Number.MAX_VALUE];
        var max = [-Number.MAX_VALUE, -Number.MAX_VALUE];

        // Get channel samples.
        this.series = [];
        _.each(channels, _.bind(function (channel) {
          var s = this.getSeriesData(channel);
          var axis = this.model.lineStyleOptions[channel.channelName].yaxis;
          if (axis === 2) {
            min[1] = Math.min(min[1], s.min);
            max[1] = Math.max(max[1], s.max);
          } else {
            min[0] = Math.min(min[0], s.min);
            max[0] = Math.max(max[0], s.max);
          }

          if (s.data.length === 0) return;
          s.color = this.app.getColors(channel.colorNum);

          if (this.model.lineStyleOptions[channel.channelName].color)
            s.color = this.model.lineStyleOptions[channel.channelName].color;
          else {
            s.color = this.app.getColors(channel.colorNum);
            this.model.lineStyleOptions[channel.channelName].color = this.color;
          }

          // Ensure each series spans the visible time.
          if (time.beg < _.first(s.data).t * 1e3) {
            s.data.unshift({t: _.first(s.data).t, v: null});
            s.data.unshift({t: time.beg / 1e3, v: null});
          }
          if (time.end > _.last(s.data).t * 1e3) {
            s.data.push({t: _.last(s.data).t, v: null});
            s.data.push({t: time.end / 1e3, v: null});
          }
          s.name = channel.channelName;
          s.axis = axis;
          this.series.push(s);
        }, this));

        $('.overview-date > span').text(
          util.toLocaleString(new Date(time.beg / 1e3), 'm/d/yyyy'));
        $('.overview-date-right > span').text(
          util.toLocaleString(new Date(time.end / 1e3), 'm/d/yyyy'));


        // remove all plots where we don't have series data
        var allPlotIds = $('.overview-plot').map(function() { return this.id; }).get();
        var toRemove = _.reject(allPlotIds, function(s) {
          return _.contains(_.pluck(this.series, 'name'), s.split('-')[1]);
        }, this);
        _.each(toRemove, function (s) { $('#' + s).remove(); });

        // Series with less samples should appear on top.
        this.series.sort(function (a, b) {
          return b.data.length - a.data.length;
        });

        // Render.
        _.each(this.series, _.bind(function (series) {

          var local_max = series.axis === 2 ? max[1] : max[0];
          var local_min = series.axis === 2 ? min[1] : min[0];

          // Map samples to x,y coordinates.  Lots of mx+b equations here
          var path = d3.svg.area()
              .x(function (s) {
                return (s.t - time.beg/1e3) / (time.end/1e3 - time.beg/1e3) * width;
              })
              .y0(function () {
                var zero = local_max === local_min ? height :
                  height - height * -local_min / (local_max - local_min);
                return zero;
              })
              .y1(function (s) {
                var zero = local_max === local_min ? height :
                  height - height * -local_min / (local_max - local_min);
                return  (s.v === null) || (local_max === local_min) ? zero:
                    height - ((s.v - local_min) / (local_max - local_min) * height);
              })
              .interpolate('linear');

          var plot = $('#overview-'+series.name);
          var height;
          if (plot.length !== 0)
            height = plot.height();
          else {
            plot = $('<div class="overview-plot">').insertBefore(this.visTimePlot);
            plot.attr('id', 'overview-' + series.name);
            height = plot.height();
            d3.select(plot.get(0))
                .append('svg:svg')
                .attr('width', width)
                .attr('height', height)
                .append('svg:g')
                .append('svg:path')
                .attr('d', path(_.map(series.data, function (x) {
                  return {t: x.t, v: 0};
                })))
                .attr('class', 'area')
                .attr('fill', series.color);
          }

          // Create SVG elements.
          d3.select(plot.get(0)).select('path')
              .transition()
              .ease('cubic-out')
              .duration(750)
              .attr('fill', series.color)
              .attr('d', path(series.data));
        }, this));

        // Check width change for resize.
        if (time.width !== this.prevWidth) {
          this.trigger('VisibleWidthChange');
          this.prevWidth = time.width;
        }
      }, this));

    },

    drawCurrentTimeOverlay: function(time) {
      this.model.fetchGraphedChannels(_.bind(function (channels) {
        if (channels.length === 0) {
          return;
        } else {
          if (!time.beg) return;
          var vs = this.getVisibleTime();
          if (!vs.beg) return;
          var height = this.visTimePlot.height();
          var width = this.$el.width();

          var width_per = (time.end-time.beg) / (vs.end - vs.beg);
          var begin = (time.beg - vs.beg) / (vs.end - vs.beg);

          var path = d3.svg.area()
              .x(function (t) { return t.x; })
              .y0(function () { return 0; })
              .y1(function (t) { return t.y; })
              .interpolate('linear');

          var factor = 0; // for scaling the trapzeoid

          // create a trapezoid
          var trap = [
            {x:Math.max((begin-factor)*width,0), y:0},
            {x:begin*width, y:height},
            {x:(begin+width_per)*width, y:height},
            {x:Math.min((begin+width_per+factor)*width, width), y:0},
          ];

          d3.select(this.visTimePlot.get(0)).select('path')
            // .transition()
            .attr('d', path(trap))
            .attr('fill', '#27CDD6')
            .attr('opacity', (1-width_per)*0.5);
            // .attr('stroke-width', 1)
            // .attr('stroke', '#b2b2b2');
        }
      }, this));
    },

    getSeriesData: function (channel) {
      var conv = units.findConversion(channel.units,
          channel.displayUnits || channel.units);
      var data = [];
      var samples = [];
      var min = Number.MAX_VALUE;
      var max = -Number.MAX_VALUE;
      if (this.model.sampleCollection[channel.channelName])
        samples = this.model.sampleCollection[channel.channelName].sampleSet;
      var prevEnd = null;
      _.each(samples, function (s) {
        var val = s.val * conv.factor;
        if (val < min) min = val;
        if (val > max) max = val;
        if (prevEnd != s.beg) {
          data.push({t: prevEnd/1e3, v:null});
          data.push({t: s.beg/1e3, v:null});
        }
        data.push({t: s.beg / 1e3, v: val});
        //if (s.beg !== s.end)
        //  data.push({t: s.end / 1e3, v: val});
        prevEnd = s.end;
      });
      return {data: data, min: min, max: max};
    },

    getVisibleTime: function () {
      return {
        beg: this.model.get('visibleTime').beg,
        end: this.model.get('visibleTime').end,
        width: this.$el.width(),
        static: true
      };
    },

    // Map x-coordinate to time width width w
    getTime: function(x, w) {
      var time = this.getVisibleTime();
      return x / w * (time.end/1e3 - time.beg/1e3) + time.beg/1e3;
    },

    overviewZoom: function(e) {
      $('#cursor-wrap-beg').css({left: e.pageX}).show();
      var initialCursorDate = $('#cursor-wrap-beg .overview-cursor-date');

      var cursorDiff = $('.overview-cursor-diff');
      cursorDiff.offset({ left: e.pageX+20 });
      cursorDiff.fadeIn();

      var x = e.pageX;
      var date = this.getTime(x, this.$el.width());
      initialCursorDate.text(util.toLocaleString(new Date(date), 'mmm d, yyyy'));

      var select = [date];
      this.selection.css({left: x, width: 0}).show();

      var mousemove = _.debounce(_.bind(function (e) {
        if (e.pageX > x) {
          this.selection.css({left: x, width: e.pageX - x});
        } else {
          this.selection.css({left: e.pageX, width: x - e.pageX});
        }
        select[1] = this.getTime(e.pageX, this.$el.width());
        cursorDiff.text(
          '\u21A4     '
          + util.getDuration(_.max(select)*1000 - _.min(select)*1000, false)
          + '     \u21A6');
        cursorDiff.offset({left: (e.pageX - x)/2 + x - cursorDiff.width()/2});
      }, this), 5);

      var mouseup = _.bind(function () {
        $(document).unbind('mouseup', mouseup);
        this.visTimePlot.unbind('mousemove', mousemove);

        cursorDiff.hide();
        $('#cursor-wrap-beg').hide();
        this.selection.hide();

        var range = {min: _.min(select), max: _.max(select)};
        if (select.length === 2) {
          if (this.parentView.cursor.hasClass('active')) {
            if (window.confirm('Your note will be discarded. Proceed?')) {
              mps.publish('note/cancel');
              mps.publish('chart/zoom', [range]);
            }
          } else {
            mps.publish('chart/zoom', [range]);
          }
        }
        select = [];
      }, this);
      $(document).bind('mouseup', mouseup);
      this.visTimePlot.bind('mousemove', mousemove);
    },

  });
});
