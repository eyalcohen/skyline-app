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
      var time;
      if (store.get('state').time)
        time = store.get('state').time;
      this.model = new Graph(this.app, {view: this, time: time});

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      
    },

    // Misc. setup.
    setup: function () {
      var t = this.getVisibleTime();
      this.trigger('VisibleTimeChange', {beg: t.beg, end: t.end});

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
      this.model.fetchGraphedChannels(_.bind(function (channels) {
        this.series = [];
        _.each(channels, _.bind(function (channel, i) {
          var seriesBase = {
            channelIndex: i,
            channelName: channel.channelName,
          };
          this.series.push(_.extend({
            data: this.getSeriesData(channel),
            color: '#e2e2e2'
          }, seriesBase));
        }, this));
        if (!this.plot) {
          this.plot = new Rickshaw.Graph({
            element: this.el,
            renderer: 'area',
            series: this.series,
          });
          this.plot.render();
        }
        else this.plot.update()
      }, this));
    },

    getSeriesData: function (channel) {
      var conv = units.findConversion(channel.units,
          channel.displayUnits || channel.units);
      var data = [];
      var samples = [];
      var offset = 0;
      if (this.model.sampleCollection[channel.channelName]) {
        samples = this.model.sampleCollection[channel.channelName].sampleSet;
        offset = this.model.sampleCollection[channel.channelName].offset;
      }
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s, i) {
        var val = s.val * conv.factor + conv.offset;
        data.push({x: (s.beg + offset) / 1000, y: val});
        prevEnd = s.end;
      });
      return data;
    },

    getVisibleTime: function () {
      var time = this.model.get('visibleTime');
      return {beg: time.beg, end: time.end, width: this.$el.width()};
    },

    setVisibleTime: function (beg, end) {
      return;
    },

  });
});

