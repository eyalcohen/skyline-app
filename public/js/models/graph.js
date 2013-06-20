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

      this.clientId = util.rid32();

      this.view = view;
      this.set('vehicleId', Number(this.view.options.vehicleId));
      this.set('visibleTime', this.view.options.visibleTime || {
        beg: (Date.now() - 7*24*60*60*1e3) * 1e3,
        end: Date.now() * 1e3,
      });

      this.cache = new Cache(app);
      // if (!args) args = {};
      // _.extend(args, { model: this });
      // this.tabModel = args.tabModel;
      // this.view = new App.views.GraphView(args);
      this.set({channels: []});
      // Note: Backbone's .set method does a deep comparison of the old
      // data to the new data, which is expensive for large datasets.  Don't
      // use .set for sampleSet to avoid this overhead.
      this.sampleSet = {};  // Map from channelName to data.
      // var tabId = args.tabId, id = args.id;
      // this.clientId = tabId + '-graph-' + id;
      // _.bindAll(this, 'destroy', 'updateCacheSubscription',
      //     'visibleTimeChanged', 'addChannel', 'removeChannel',
      //     'fetchGraphedChannels', 'updateSampleSet');
      // App.subscribe('VehicleUnrequested-' + tabId, this.destroy);
      // this.tabModel.bind('change:visibleTime', this.visibleTimeChanged);
      // App.subscribe('ChannelRequested-' + tabId + '-' + id, this.addChannel);
      // App.subscribe('ChannelUnrequested-' + tabId + '-' + id, this.removeChannel);
      // App.subscribe('FetchGraphedChannels-' + tabId, this.fetchGraphedChannels);
      this.cache.bind('update-' + this.clientId, _.bind(this.updateSampleSet, this));
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        this.set({visibleTime: visibleTime});
        this.updateCacheSubscription();
      }, this));
      this.view.bind('VisibleWidthChange', _.bind(this.updateCacheSubscription, this));
      // this.view.render();

      return this;
    },

    // destroy: function () {
    //   var tabId = this.get('tabId'), id = this.get('id');
    //   App.unsubscribe('VehicleUnrequested-' + tabId, this.destroy);
    //   this.tabModel.unbind('change:visibleTime', this.visibleTimeChanged);
    //   App.unsubscribe('ChannelRequested-'+ tabId + '-' + id, this.addChannel);
    //   App.unsubscribe('ChannelUnrequested-' + tabId + '-' + id,
    //                   this.removeChannel);
    //   App.unsubscribe('FetchGraphedChannels-' + tabId,
    //                   this.fetchGraphedChannels);
    //   App.sampleCache.unbind('update-' + this.clientId, this.updateSampleSet);
    //   App.sampleCache.endClient(this.clientId);
    //   this.view.destroy();
    // },

    updateCacheSubscription: function () {
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
      this.cache.setClientView(
          this.clientId, this.get('vehicleId'),
          _.pluck(this.get('channels'), 'channelName'),
          dur, this.prevRange.beg, this.prevRange.end);
    },

    visibleTimeChanged: function (model, visibleTime) {
      this.view.setVisibleTime(visibleTime.beg, visibleTime.end);
    },

    addChannel: function (channels) {
      var self = this;
      channels = _.isArray(channels) ? channels : [channels];

      var numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
      _.each(self.get('channels'), function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesLeftAxis++;
        else
          numSeriesRightAxis++;
      });
      var yAxisNumToUse = numSeriesLeftAxis > numSeriesRightAxis ? 2 : 1;

      _.each(channels, function (channel) {
        if (_.pluck(self.get('channels'), 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        // channel = _.clone(channel);
        if (!channel.yaxisNum)
          channel.yaxisNum = yAxisNumToUse;
        if (!channel.colorNum) {
          var usedColors = _.pluck(self.get('channels'), 'colorNum');
          for (var c = 0; _.include(usedColors, c); ++c) { }
          channel.colorNum = c;
        }
        self.get('channels').push(channel);
        console.log('addChannel(', channel, ')...');
      });
      self.updateCacheSubscription();
      // App.publish('GraphedChannelsChanged-' + self.get('tabId'), []);
      return self;
    },

    // removeChannel: function (channel) {
    //   var self = this;
    //   var index = _.pluck(self.get('channels'), 'channelName')
    //                       .indexOf(channel.channelName);
    //   if (index === -1) return;
    //   self.get('channels').splice(index, 1);
    //   // console.log('removeChannel(', channel, ')...');
    //   self.updateCacheSubscription();
    //   App.publish('GraphedChannelsChanged-' + self.get('tabId'), []);
    //   return self;
    // },

    fetchGraphedChannels: function(cb) {
      cb(this.get('channels'));
    },

    updateSampleSet: function (sampleSet) {
      this.sampleSet = sampleSet;
      this.view.draw();
    },


  });
});

