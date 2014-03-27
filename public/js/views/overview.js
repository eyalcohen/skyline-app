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

    // The DOM target element for this page.
    el: '.overview',

    // Module entry point.
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
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

    // Draw template.
    render: function () {

      // Init a model for this view.
      this.model = new Graph(this.app, {view: this, silent: true});

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
    },

    // Misc. setup.
    setup: function () {

      // Safe refs.
      this.selection = this.$('.overview-selection');

      this.visTimePlot = $('<div class="overview-vis">').appendTo(this.$el);
      this.visTimePlot.bind('mousedown', _.bind(this.overviewZoom, this));

      var path = d3.svg.area()
        .x(this.$el.width()/2)
        .y0(0)
        .y1(this.visTimePlot.height())

      var svg = d3.select(this.visTimePlot.get(0))
        .append('svg:svg')
        .attr('width', this.$el.width())
        .attr('height', this.visTimePlot.height())
        .append('svg:g')
        .append('svg:path')
        .attr('d', path([0, 0]))

      // Do resize on window change.
      $(window).resize(_.debounce(_.bind(this.draw, this), 40));

      // Show parent.
      _.delay(_.bind(function () {
        this.$el.css({opacity: 1});
      }, this), 500);

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
      this.remove();
    },

    draw: function () {
      var time = this.getVisibleTime();
      var width = this.$el.width();

      // Clear plots.
      this.$('.overview-plot').remove();

      // Make a plot for each channel.
      this.model.fetchGraphedChannels(_.bind(function (channels) {

        // Get channel samples.
        this.series = [];
        _.each(channels, _.bind(function (channel) {
          var s = this.getSeriesData(channel);
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
          this.series.push(s);
        }, this));

        // Series with less samples should appear on top.
        this.series.sort(function (a, b) {
          return b.data.length - a.data.length;
        });

        // Render.
        _.each(this.series, _.bind(function (series) {
          var plot = $('<div class="overview-plot">').insertBefore(this.visTimePlot);
          var height = plot.height();
          var min = _.first(series.data).t;
          var max = _.last(series.data).t;

          // Map samples to x,y coordinates.
          var path = d3.svg.area()
              .x(function (s) {
                return (s.t - time.beg/1e3) / (time.end/1e3 - time.beg/1e3) * width;
              })
              .y0(height)
              .y1(function (s) {
                return height - ((s.v - series.min) / (series.max - series.min) * height);
              })
              .interpolate('linear');

          // Create SVG elements.
          var svg = d3.select(plot.get(0))
              .append('svg:svg')
              .attr('width', width)
              .attr('height', height)
              .append('svg:g')
              .append('svg:path')
              .attr('d', path(_.map(series.data, function(x) {
                return {t: x.t, v: series.max}})))
              .attr('class', 'area')
              .attr('fill', series.color)
              .transition()
              .duration(750)
              .attr('d', path(series.data))

        }, this));

        // Check width change for resize.
        if (time.width !== this.prevWidth) {
          this.trigger('VisibleWidthChange');
          this.prevWidth = time.width;
        }
      }, this));

    },

    drawCurrentTimeOverlay: function(time) {
      if (!time.beg) return;
      var vs = this.getVisibleTime();
      if (!vs.beg) return;
      var height = this.visTimePlot.height();
      var width = this.$el.width();

      var width_per = (time.end-time.beg) / (vs.end - vs.beg);
      var begin = (time.beg - vs.beg) / (vs.end - vs.beg)

      var path = d3.svg.area()
          .x(function (t) { return t.x; })
          .y0(function (t) { return 0; })
          .y1(function (t) { return t.y; })
          .interpolate('linear');

      var factor = .01 // for scaling the trapzeoid

      // create a trapezoid
      var trap = [{x:begin*width, y:0},
                  {x:begin*width, y:height*2/3},
                  {x:Math.min((begin+factor), (begin+width_per/2))*width, y:height},
                  {x:Math.max((begin+width_per-factor), (begin + width_per/2))*width, y:height},
                  {x:(begin+width_per)*width, y:height*2/3},
                  {x:(begin+width_per)*width, y:0}];

      d3.select(this.visTimePlot.get(0)).select('path')
        .transition()
        .attr('d', path(trap))
        .attr('fill', '#fcd744')
        .attr('opacity', (1-width_per)*2)
        .attr('stroke-width', 1)
        .attr('stroke', '#b2b2b2');

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
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s) {
        var val = s.val * conv.factor;
        if (val < min) min = val;
        if (val > max) max = val;
        data.push({t: s.beg / 1e3, v: val});
        if (s.beg !== s.end)
          data.push({t: s.end / 1e3, v: val});
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

    overviewZoom: function(e) {

      var time = this.getVisibleTime();

      // Map x-coordinate to time.
      function getTime(x, w) {
        return x / w * (time.end/1e3 - time.beg/1e3) + time.beg/1e3;
      }

      var x = e.pageX;
      var w = this.visTimePlot.width();
      var select = [getTime(x, w)];
      this.selection.css({left: x, width: 0}).show();
      var mousemove = _.bind(function (e) {
        if (e.pageX > x)
          this.selection.css({left: x, width: e.pageX - x});
        else
          this.selection.css({left: e.pageX, width: x - e.pageX});
        select[1] = getTime(e.pageX, w);
      }, this);
      var mouseup = _.bind(function (e) {
        $(document).unbind('mouseup', mouseup);
        this.visTimePlot.unbind('mousemove', mousemove);
        this.selection.hide();
        if (select.length === 2)
          mps.publish('chart/zoom', [{
            min: _.min(select),
            max: _.max(select)
          }]);
        select = [];
      }, this);
      $(document).bind('mouseup', mouseup);
      this.visTimePlot.bind('mousemove', mousemove);
    },

    updateColor: function(channel, opts) {

    }

  });
});
