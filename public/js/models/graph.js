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
      var time;
      if (store.get('state').time)
        time = store.get('state').time;
      else if (this.app.profile.content.datasets
          && this.app.profile.content.datasets.items.length > 0)
        time = this.app.profile.content.datasets.items[0].meta;
      else
        time = {
          beg: (Date.now() - 7*24*60*60*1e3) * 1e3,
          end: Date.now() * 1e3,
        };
      this.set('visibleTime', time);
      this.cache = new Cache(this.app);
      this.set({channels: []});
      this.sampleCollection = [];

      // View change events.
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        this.set({visibleTime: visibleTime});
        this.updateCacheSubscription();
        this.view.setVisibleTime(visibleTime.beg, visibleTime.end);
        var state = store.get('state');
        state.time = visibleTime;
        store.set('state', state);
      }, this));
      this.view.bind('VisibleWidthChange', _.bind(this.updateCacheSubscription, this));

      return this;
    },

    getOrCreateClient: function (dataset) {
      var client = _.find(this.clients, function (c) {
        return c.dataset === dataset;
      });
      if (client) return client;
      client = {id: util.rid32(), dataset: dataset, channels: [] };
      this.clients.push(client);
      this.cache.bind('update-' + client.id, _.bind(this.updateSampleSet, this, dataset));
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
        var offset = c.dataset.get('offset')
        this.cache.setClientView(
            c.id, c.dataset.get('id'),
            _.pluck(c.channels, 'channelName'),
            dur, this.prevRange.beg + offset, this.prevRange.end + offset);
      }
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
        datasets.push(client.dataset)
      });
      return datasets;
    },

    changeDatasetOffset: function (datasetId, newOfset) {
      var client = _.find(this.clients, function (cl) {
        cl.id == datasetId;
      });
      if (!client) return;
      client.offset = newOffset;
    },

    addChannel: function (dataset, channels) {
      if (!dataset) return;
      var datasetId = dataset.get('id')
      channels = _.isArray(channels) ? channels : [channels];

      var numSeriesRightAxis = 0, numSeriesLeftAxis = 0;
      _.each(this.getChannels(), _.bind(function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesRightAxis++;
        else
          numSeriesLeftAxis++;
      }, this));
      var yAxisNumToUse = numSeriesRightAxis > numSeriesLeftAxis ? 2 : 1;

      var client = this.getOrCreateClient(dataset);
      _.each(channels, _.bind(function (channel) {
        if (_.pluck(client.channels, 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        if (!channel.yaxisNum)
          channel.yaxisNum = yAxisNumToUse;
        if (channel.colorNum === undefined) {
          var usedColors = _.pluck(this.getChannels(), 'colorNum');
          for (var c = 0; _.include(usedColors, c); ++c) {}
          channel.colorNum = c;
        }
        if (!channel.title) channel.title = channel.channelName;
        if (!channel.humanName) channel.humanName = channel.channelName;
        if (!channel.shortName) channel.shortName = channel.channelName;
        client.channels.push(channel);
        mps.publish('channel/added', [datasetId, channel]);
        console.log('addChannel(', channel, ')...');
      }, this));
      this.updateCacheSubscription(client);
      // mps.publish('view/save/status', [true]);
      return this;
    },

    removeChannel: function (dataset, channel) {
      if (!dataset) return;
      var datasetId = dataset.get('id')
      var client = this.getOrCreateClient(dataset);
      var index = _.pluck(client.channels, 'channelName')
                          .indexOf(channel.channelName);
      if (index === -1) return;
      client.channels.splice(index, 1);
      channel.did = datasetId;
      mps.publish('channel/removed', [datasetId, channel]);
      console.log('removeChannel(', channel, ')...');
      this.updateCacheSubscription(client);
      // if (this.getChannels().length === 0)
      //   mps.publish('view/save/status', [false]);
      return this;
    },

    fetchGraphedChannels: function(cb) {
      cb(this.getChannels());
    },

    updateSampleSet: function (dataset, sampleSet) {
      var offset = dataset.get('offset')
      _.each(sampleSet, _.bind(function (ss, cn) {
        this.sampleCollection[cn] = {sampleSet:ss, offset:offset};
      }, this));
      this.view.draw();
    },


  });
});

