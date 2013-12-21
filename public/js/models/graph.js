/*
 * Graph model
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'cache',
  'shared'
], function ($, _, Backbone, mps, util, Cache, shared) {

  return Backbone.Model.extend({

    initialize: function (app, options) {
      this.app = app;
      this.view = options.view;
      this.clients = [];
      this.options = options;

      this.DEFAULT_LINE_STYLE = {
        showPoints: true,
        showLines: true,
        interpolation: 'linear', // also 'none'
        lineWidth: 2,
        pointRadius: 3,
        color: null,
      }

      // channelName -> showPoints:{true, false}
      var s = store.get('state').lineStyleOptions;
      this.lineStyleOptions = s ? s : {}

      this.set('visibleTime', options.time || {});
      this.cache = new Cache(this.app);
      this.set({channels: []});
      this.sampleCollection = [];

      // View change events.
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        var vt = this.get('visibleTime');
        if (vt.beg === visibleTime.beg
            && vt.end === visibleTime.end) return;
        this.set({visibleTime: visibleTime});
        this.updateCacheSubscription();
        this.view.setVisibleTime(visibleTime.beg, visibleTime.end);
        var state = store.get('state');
        state.time = visibleTime;
        this.app.state(state);
      }, this));
      this.view.bind('VisibleWidthChange',
          _.bind(this.updateCacheSubscription, this));

      return this;
    },

    getOrCreateClient: function (dataset) {
      var client = _.find(this.clients, function (c) {
        return c.dataset === dataset;
      });
      if (client) return client;
      client = {id: util.rid32(), dataset: dataset, channels: []};
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
      if (viewRange.static) {
        viewRange.beg = Number.MAX_VALUE;
        viewRange.end = -Number.MAX_VALUE;
        _.each(this.clients, function (client) {
          if (client.channels.length === 0) return;
          if (viewRange.beg > client.dataset.get('beg'))
            viewRange.beg = client.dataset.get('beg');
          if (viewRange.end < client.dataset.get('end'))
            viewRange.end = client.dataset.get('end'); 
        });
      }
      var dur = this.cache.getBestGraphDuration(
          (viewRange.end - viewRange.beg) / viewRange.width);
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
      if (!_.isObject(client))
        _.each(this.clients, _.bind(function (c) {
          set.call(this, c);
        }, this));
      else
        set.call(this, client);

      // Expand effective view range slightly, so that when scrolling we fetch
      // more data before it's needed.
      function expandRange(range, factor) {
        var extend = (range.end - range.beg) * factor;
        return _.defaults({beg: range.beg - extend, end: range.end + extend}, range);
      }

      function set(c) {
        var offset = c.dataset.get('offset');
        var beg, end;
        if (viewRange.static) {
          beg = this.prevRange.beg;
          end = this.prevRange.end;
        } else {
          beg = this.prevRange.beg - offset;
          end = this.prevRange.end - offset;
        }
        this.cache.setClientView(c.id, c.dataset.get('id'),
            _.pluck(c.channels, 'channelName'), dur, beg, end);
      }
    },

    findDatasetFromChannel: function(channelName) {
      var client =  _.find(this.clients, function (client) {
        return _.find(client.channels, function (channels) {
          return channels.channelName == channelName;
        });
      });
      return client ? client.dataset : undefined;
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

      // if this channel is way off the screen, and there is no
      // offset, bring it over.
      var visTime = this.view.getVisibleTime();
      var offsetChanged = false;

      if (!visTime.static) {
        // we consider a dataset that is completely off the screen by a factor
        // of 2 as one that needs to be 'brought over'
        var factor = 0; // Tweak this number to control this effect.
        var dur = (visTime.end - visTime.beg) * factor;
        if (dataset.get('offset') == 0) {
          if (visTime.beg > dataset.get('end') + dur 
              || visTime.end < dataset.get('beg') - dur) {
            dataset.set('offset', visTime.beg - dataset.get('beg'));
            offsetChanged = true;
          }
        }
      }

      // Choose an axis.
      var numSeriesRightAxis = 0, numSeriesLeftAxis = 0;
      _.each(this.getChannels(), _.bind(function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesRightAxis++;
        else
          numSeriesLeftAxis++;
      }, this));
      var yAxisNumToUse = numSeriesRightAxis > numSeriesLeftAxis ? 2 : 1;

      // Update client.
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
        if (!this.lineStyleOptions[channel.channelName]) {
          this.lineStyleOptions[channel.channelName] = {};
          _.extend(this.lineStyleOptions[channel.channelName],this.DEFAULT_LINE_STYLE);
        }
        client.channels.push(channel);
        if (!this.options.silent) {
          mps.publish('channel/added', [datasetId, channel,
                                       this.lineStyleOptions[channel.channelName]]);
          console.log('addChannel(', channel, ')...');
        }
      }, this));
      this.updateCacheSubscription(client);
      if (offsetChanged)
        mps.publish('graph/offsetChanged', []);
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
      if (!this.options.silent) {
        mps.publish('channel/removed', [datasetId, channel]);
        console.log('removeChannel(', channel, ')...');
      }
      this.updateCacheSubscription(client);
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

    setDatasetOffset: function(channelName, newOffset) {
      var dataset = this.findDatasetFromChannel(channelName);

      // Update offset by adding to old offset.
      dataset.set('offset', newOffset)
      this.updateCacheSubscription(this.getOrCreateClient(dataset));
    },

    getDatasetOffset: function(channelName) {
      var dataset = this.findDatasetFromChannel(channelName);
      return dataset.get('offset') || 0;
    },

    setUserLineStyle: function(channel, opts) {
      for (var attrname in opts) {
        this.lineStyleOptions[channel][attrname] = opts[attrname];
      }
      var state = store.get('state');
      state.lineStyleOptions = {};
      _.extend(state.lineStyleOptions, this.lineStyleOptions);
      store.set('state', state);
      var state = store.get('state');
      this.view.draw();
    }

  });
});

