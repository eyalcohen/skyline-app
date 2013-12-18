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
  'Rickshaw'
], function ($, _, Backbone, mps, util, units, Graph, Rickshaw) {

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
      this.subscriptions = [];
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

      // Do resize on window change.
      $(window).resize(_.debounce(_.bind(this.draw, this), 40));

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
      var t = this.getVisibleTime();

      // Clear plots.
      this.empty();

      // Make a plot for each channel.
      this.model.fetchGraphedChannels(_.bind(function (channels) {

        // Get channel samples.
        this.series = [];
        _.each(channels, _.bind(function (channel) {
          var data = this.getSeriesData(channel);
          if (data.length === 0) return;

          // Ensure each series spans the visible time.
          if (t.beg < _.first(data).x * 1e3) {
            data.unshift({x: _.first(data).x, y: null});
            data.unshift({x: t.beg / 1e3, y: null});
          }
          if (t.end > _.last(data).x * 1e3) {
            data.push({x: _.last(data).x, y: null});
            data.push({x: t.end / 1e3, y: null});
          }
          var s = {channel: channel, data: data};
          this.series.push(s);
        }, this));

        // Series with less samples should appear on top.
        this.series.sort(function (a, b) {
          return b.data.length - a.data.length;
        });

        // Render.
        _.each(this.series, _.bind(function (series) {
          new Rickshaw.Graph({
            element: $('<div>').appendTo(this.$el).get(0),
            renderer: 'area',
            series: [{
              data: series.data, 
              color: this.app.colors[series.channel.colorNum]
            }],
            interpolation: 'linear'
          }).render();
        }, this));

        // Check width change for resize.
        if (t.width !== this.prevWidth) {
          this.trigger('VisibleWidthChange');
          this.prevWidth = t.width;
        }
      }, this));
    },

    getSeriesData: function (channel) {
      var conv = units.findConversion(channel.units,
          channel.displayUnits || channel.units);
      var data = [];
      var samples = [];
      if (this.model.sampleCollection[channel.channelName])
        samples = this.model.sampleCollection[channel.channelName].sampleSet;
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s, i) {
        var val = s.val * conv.factor;
        data.push({x: s.beg / 1e3, y: val});
        if (s.beg !== s.end)
          data.push({x: s.end / 1e3, y: val});
        prevEnd = s.end;
      });
      return data;
    },

    getVisibleTime: function () {
      return {
        beg: this.model.get('visibleTime').beg,
        end: this.model.get('visibleTime').end,
        width: this.$el.width(),
        static: true
      };
    },

  });
});
