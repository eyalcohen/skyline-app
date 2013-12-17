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

      this.empty();
      this.model.fetchGraphedChannels(_.bind(function (channels) {
        this.series = [];
        _.each(channels, _.bind(function (channel, i) {
          var data = this.getSeriesData(channel);
          if (data.length === 0) return;
          var plot = new Rickshaw.Graph({
            element: $('<div>').appendTo(this.$el).get(0),
            renderer: 'area',
            series: [{data: data, color: this.app.colors[channel.colorNum]}],
          });
          plot.render();

          // var seriesBase = {
          //   channelIndex: i,
          //   channelName: channel.channelName,
          // };

        }, this));
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
      return {beg: null, end: null, width: this.$el.width(), static: true};
    },

    setVisibleTime: function (beg, end) {
      return;
    },

  });
});

