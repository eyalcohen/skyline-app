/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.tabModel = args.tabModel;
      this.view = new App.views.GraphView(args);
      this.set({
        channels: [],
      });
      // Note: Backbone's .set method does a deep comparison of the old
      // data to the new data, which is expensive for large datasets.  Don't
      // use .set for sampleSet to avoid this overhead.
      this.sampleSet = {};  // Map from channelName to data.
      var tabId = args.tabId, id = args.id;
      this.clientId = tabId + '-graph-' + id;
      _.bindAll(this, 'destroy', 'updateCacheSubscription',
          'visibleTimeChanged', 'addChannel', 'removeChannel',
          'fetchGraphedChannels', 'updateSampleSet');
      App.subscribe('VehicleUnrequested-' + tabId, this.destroy);
      this.tabModel.bind('change:visibleTime', this.visibleTimeChanged);
      App.subscribe('ChannelRequested-' + tabId + '-' + id, this.addChannel);
      App.subscribe('ChannelUnrequested-' + tabId + '-' + id,
                    this.removeChannel);
      App.subscribe('FetchGraphedChannels-' + tabId, this.fetchGraphedChannels);
      App.sampleCache.bind('update-' + this.clientId, this.updateSampleSet);
      this.view.bind('VisibleTimeChange', _.bind(function (visibleTime) {
        this.tabModel.set({ visibleTime: visibleTime });
        this.updateCacheSubscription();
      }, this));
      this.view.bind('VisibleWidthChange', this.updateCacheSubscription);
      this.view.render();

      return this;
    },

    destroy: function () {
      var tabId = this.get('tabId'), id = this.get('id');
      App.unsubscribe('VehicleUnrequested-' + tabId, this.destroy);
      this.tabModel.unbind('change:visibleTime', this.visibleTimeChanged);
      App.unsubscribe('ChannelRequested-'+ tabId + '-' + id, this.addChannel);
      App.unsubscribe('ChannelUnrequested-' + tabId + '-' + id,
                      this.removeChannel);
      App.unsubscribe('FetchGraphedChannels-' + tabId,
                      this.fetchGraphedChannels);
      App.sampleCache.unbind('update-' + this.clientId, this.updateSampleSet);
      App.sampleCache.endClient(this.clientId);
      this.view.destroy();
    },

    updateCacheSubscription: function () {
      var viewRange = this.view.getVisibleTime();
      if (!viewRange) return;
      // When the tab holding the graph is hidden, the graph width becomes
      // negative! Some heuristics to avoid fetching unnecessary amounts of
      // data.
      if (viewRange.width <= 0) return;
      viewRange.width = Math.max(viewRange.width, 2000);
      var dur = App.sampleCache.getBestGraphDuration(
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
      App.sampleCache.setClientView(
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
      _.each(channels, function (channel) {
        if (_.pluck(self.get('channels'), 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        // channel = _.clone(channel);
        if (!channel.colorNum) {
          var usedColors = _.pluck(self.get('channels'), 'colorNum');
          for (var c = 0; _.include(usedColors, c); ++c) { }
          channel.colorNum = c;
        }
        self.get('channels').push(channel);
        // console.log('addChannel(', channel, ')...');
      });
      self.updateCacheSubscription();
      App.publish('GraphedChannelsChanged-' + self.get('tabId'), []);
      return self;
    },

    removeChannel: function (channel) {
      var self = this;
      var index = _.pluck(self.get('channels'), 'channelName')
          .indexOf(channel.channelName);
      if (index === -1) return;
      self.get('channels').splice(index, 1);
      // console.log('removeChannel(', channel, ')...');
      self.updateCacheSubscription();
      App.publish('GraphedChannelsChanged-' + self.get('tabId'), []);
      return self;
    },

    fetchGraphedChannels: function(cb) {
      cb(this.get('channels'));
    },

    updateSampleSet: function (sampleSet) {
      this.sampleSet = sampleSet;
      this.view.draw();
    },


  });
});

