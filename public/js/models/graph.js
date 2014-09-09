/*
 * Graph model
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'shared'
], function ($, _, Backbone, mps, util, shared) {

  return Backbone.Model.extend({

    initialize: function (app, options) {
      this.app = app;
      this.cache = app.cache;
      this.view = options.view;
      this.options = options;

      // The initial style.
      this.DEFAULT_LINE_STYLE = {
        showPoints: true,
        showLines: true,
        showArea: false,
        interpolation: 'linear', // also 'none'
        lineWidth: 2,
        pointRadius: 3,
        color: null,
        yaxis: 1
      };

      // channelName -> showPoints:{true, false}
      var s = store.get('state').lineStyleOptions;
      this.lineStyleOptions = s ? s : {}

      this.set('visibleTime', options.time || {});
      this.set({channels: []});
      this.sampleCollection = [];

      // View change events.
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        var vt = this.get('visibleTime');
        if (vt.beg === visibleTime.beg
            && vt.end === visibleTime.end) {
          return;
        }
        this.set({visibleTime: visibleTime});
        this.updateCacheSubscription();
        this.view.setVisibleTime(visibleTime.beg, visibleTime.end);
        var state = store.get('state');
        state.time = visibleTime;
        this.app.state(state, this.options.time.pending);
        if (this.options.time.pending) {
          this.options.time.pending = false;
        }
      }, this));

      this.view.bind('VisibleWidthChange',
          _.bind(this.updateCacheSubscription, this));

      this.clientId = util.rid32();
      this.cache.connectClient(this.clientId, {getHigherDuration: !options.static});

      this.cache.bind('update-' + this.clientId,
          _.bind(this.updateSampleSet, this));

      return this;
    },

    updateCacheSubscription: function () {
      var channels = this.getChannels();
      if (channels.length === 0) return;

      var viewRange = this.view.getVisibleTime();
      if (!viewRange) return;
      // When the tab holding the graph is hidden, the graph width becomes
      // negative! Some heuristics to avoid fetching unnecessary amounts of
      // data.
      if (viewRange.width <= 0) return;
      viewRange.width = Math.max(viewRange.width, 2000);
      if (viewRange.static) {
        viewRange.beg = _.min(_.pluck(channels, 'beg'));
        viewRange.end = _.max(_.pluck(channels, 'end'));
      }
      var dur = this.cache.getBestGraphDuration(
          (viewRange.end - viewRange.beg) / viewRange.width, viewRange.static);
      viewRange = expandRange(viewRange, 0.05);
      if (viewRange.static)
        this.set({visibleTime: {beg: viewRange.beg, end: viewRange.end}});
      // When necessary to fetch more data, fetch twice as much as necessary,
      // so we can scroll and zoom smoothly without excessive redrawing.
      if (this.prevDur != dur || this.prevRange == null ||
          this.prevRange.beg > viewRange.beg ||
          this.prevRange.end < viewRange.end) {
        // Either duration has changed, or the new view does not overlap the
        // data we've already fetched.
        this.prevDur = dur;
        this.prevRange = !viewRange.static ?
            expandRange(viewRange, 0.25): viewRange;
      }

      // Expand effective view range slightly, so that when scrolling we fetch
      // more data before it's needed.
      function expandRange(range, factor) {
        var extend = (range.end - range.beg) * factor;
        return _.defaults({beg: range.beg - extend, end: range.end + extend}, range);
      }

      var beg, end;
      beg = this.prevRange.beg;
      end = this.prevRange.end;

      this.cache.updateSubscription(this.clientId, dur, beg, end);
    },

    addChannel: function (dataset, channels, silent) {
      if (!dataset) return;
      var datasetId = dataset.get('id');
      channels = _.isArray(channels) ? channels : [channels];

      // if this channel is way off the screen, and there is no
      // offset, bring it over.
      var visTime = this.view.getVisibleTime();

      // Update client.
      _.each(channels, _.bind(function (channel) {
        if (_.pluck(this.getChannels(), 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        if (channel.colorNum === undefined) {
          var usedColors = _.pluck(this.getChannels(), 'colorNum');
          for (var c = 0; _.include(usedColors, c); ++c) {}
          channel.colorNum = c;
        }
        if (!channel.title) channel.title = channel.channelName;
        if (!channel.humanName) channel.humanName = channel.channelName;
        if (!channel.shortName) channel.shortName = channel.channelName;
        if (!this.lineStyleOptions[channel.channelName]) {
          this.lineStyleOptions[channel.channelName] = {};
          _.extend(this.lineStyleOptions[channel.channelName],this.DEFAULT_LINE_STYLE);
        }
        channel.author = dataset.get('author');

        this.cache.addChannel(this.clientId, channel);
        this.updateCacheSubscription();

        if (!this.options.silent) {
          mps.publish('channel/added', [datasetId, channel,
              this.lineStyleOptions[channel.channelName], silent]);
          console.log('addChannel(', channel, ')...');
        }
      }, this));
      // if (offsetChanged)
      //   mps.publish('graph/offsetChanged', []);
      return this;
    },

    removeChannel: function (dataset, channel) {
      this.cache.removeChannel(this.clientId, channel);
      //this.updateCacheSubscription();

      var datasetId = dataset.get('id');
      channel.did = datasetId;

      if (!this.options.silent) {
        mps.publish('channel/removed', [datasetId, channel]);
        console.log('removeChannel(', channel, ')...');
      }
      return this;
    },

    getChannels: function() {
      var channels = [];
      _.each(this.cache.getChannels(this.clientId), function (c) {
        channels.push(c);
      });
      return channels;
    },

    updateSampleSet: function (sampleSet) {
      var channels = this.getChannels();
      // var offset = dataset.get('offset')
      _.each(sampleSet, _.bind(function (ss, cn) {
        this.sampleCollection[cn] = {sampleSet: ss, offset: 0};
        var channel = _.find(channels, function (c) {
          return c.channelName === cn;
        });
        if (channel) {
          channel.range = {min: Infinity, max: -Infinity};
          _.each(ss, function (s) {
            if (s.val < channel.range.min)
              channel.range.min = s.val;
            if (s.val > channel.range.max)
              channel.range.max = s.val;
          });
        }
      }, this));
      this.view.draw();
    },

    setUserLineStyle: function(channel, opts, save) {
      for (var attrname in opts) {
        if (opts.hasOwnProperty(attrname)) {
          try {
            this.lineStyleOptions[channel][attrname] = opts[attrname];
          } catch (e) {}
        }
      }
      var state = store.get('state');
      state.lineStyleOptions = {};
      _.extend(state.lineStyleOptions, this.lineStyleOptions);
      if (save) this.app.state(state);
      this.view.draw();
    }

  });
});

