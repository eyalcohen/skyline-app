/*
 * Graph model
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'cache'
], function ($, _, Backbone, mps, util, Cache) {

  return Backbone.Model.extend({

    initialize: function (app, view) {
      this.app = app;
      this.view = view;
      this.clients = [];
      this.set('visibleTime', this.app.profile.content.datasets
          && this.app.profile.content.datasets.items.length > 0
          ? this.app.profile.content.datasets.items[0].meta: {
        beg: (Date.now() - 7*24*60*60*1e3) * 1e3,
        end: Date.now() * 1e3,
      });
      this.cache = new Cache(this.app);
      this.set({channels: []});
      this.sampleSet = {};
      
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        this.set({visibleTime: visibleTime});
        this.updateCacheSubscription();
      }, this));
      this.view.bind('VisibleWidthChange', _.bind(this.updateCacheSubscription, this));

      return this;
    },

    getOrCreateClient: function (datasetId) {
      var client = _.find(this.clients, function (c) {
        return c.datasetId === datasetId;
      });
      if (client) return client;
      client = {id: util.rid32(), datasetId: datasetId, channels: []};
      this.clients.push(client);
      this.cache.bind('update-' + client.id, _.bind(this.updateSampleSet, this, datasetId));
      return client;
    },

    updateCacheSubscription: function (client) {
      var viewRange = this.view.getVisibleTime();
      if (!viewRange) return;
      // When the tab holding the graph is hidden, the graph width becomes
      // negative! Some heuristics to avoid fetching unnecessary amounts of
      // data.
      if (viewRange.width <= 0) return;
      viewRange.width = Math.max(viewRange.width, 2000);
      var dur = this.cache.getBestGraphDuration(
          (viewRange.end - viewRange.beg) / viewRange.width);
      // Expand effective view range slightly, so that when scrolling we fetch
      // more data before it's needed.
      function expandRange(range, factor) {
        var extend = (range.end - range.beg) * factor;
        return { beg: range.beg - extend, end: range.end + extend };
      }
      viewRange = expandRange(viewRange, 0.1);
      // When necessary to fetch more data, fetch twice as much as necessary,
      // so we can scroll and zoom smoothly without excessive redrawing.
      if (this.prevDur != dur || this.prevRange == null ||
          this.prevRange.beg > viewRange.beg ||
          this.prevRange.end < viewRange.end) {
        // Either duration has changed, or the new view does not overlap the
        // data we've already fetched.
        this.prevDur = dur;
        this.prevRange = expandRange(viewRange, 0.25);
      }

      if (!_.isObject(client))
        _.each(this.clients, _.bind(function (c) {
          set.call(this, c);
        }, this));
      else set.call(this, client);

      function set(c) {
        this.cache.setClientView(
            c.id, c.datasetId,
            _.pluck(c.channels, 'channelName'),
            dur, this.prevRange.beg, this.prevRange.end);
      }
    },

    visibleTimeChanged: function (model, visibleTime) {
      this.view.setVisibleTime(visibleTime.beg, visibleTime.end);
    },

    getChannels: function () {
      var channels = [];
      _.each(this.clients, function (client) {
        _.each(client.channels, function (c) {
          channels.push(c);
        });
      });
      return channels;
    },

    getChannelsByDataset: function () {
      var datasets = [];
      _.each(this.clients, function (client) {
        if (client.channels.length === 0) return;
        datasets.push({
          _id: Number(client.datasetId),
          channels: client.channels,
        });
      });
      return datasets;
    },

    addChannel: function (datasetId, channels) {
      var self = this;
      channels = _.isArray(channels) ? channels : [channels];

      var numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
      _.each(self.getChannels(), function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesLeftAxis++;
        else
          numSeriesRightAxis++;
      });
      var yAxisNumToUse = numSeriesLeftAxis > numSeriesRightAxis ? 2 : 1;

      var client = this.getOrCreateClient(datasetId);
      _.each(channels, function (channel) {
        if (_.pluck(client.channels, 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        if (!channel.yaxisNum)
          channel.yaxisNum = yAxisNumToUse;
        if (!channel.colorNum) {
          var usedColors = _.pluck(self.getChannels(), 'colorNum');
          for (var c = 0; _.include(usedColors, c); ++c) { }
          channel.colorNum = c;
        }
        if (!channel.title) channel.title = channel.channelName;
        if (!channel.humanName) channel.humanName = channel.channelName;
        if (!channel.shortName) channel.shortName = channel.channelName;
        client.channels.push(channel);
        mps.publish('channel/added', [channel]);
        console.log('addChannel(', channel, ')...');
      });
      self.updateCacheSubscription(client);
      mps.publish('view/save/status', [true]);
      return self;
    },

    removeChannel: function (datasetId, channel) {
      var self = this;
      var client = this.getOrCreateClient(datasetId);
      var index = _.pluck(client.channels, 'channelName')
                          .indexOf(channel.channelName);
      if (index === -1) return;
      client.channels.splice(index, 1);
      mps.publish('channel/removed', [channel]);
      console.log('removeChannel(', channel, ')...');
      self.updateCacheSubscription(client);
      if (this.getChannels().length === 0)
        mps.publish('view/save/status', [false]);
      return self;
    },

    fetchGraphedChannels: function(cb) {
      cb(this.getChannels());
    },

    updateSampleSet: function (datasetId, sampleSet) {
      _.each(sampleSet, _.bind(function (ss, cn) {
        this.sampleSet[cn] = ss;
      }, this));
      this.view.draw();
    },


  });
});

