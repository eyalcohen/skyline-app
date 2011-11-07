/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      var self = this;
      if (!args) args = {};
      _.extend(args, { model: self });
      self.view = new App.views.GraphView(args);
      self.set({
        channels: [],
        beg: null, end: null, // Viewed time range.
      });
      // Note: Backbone's .set method does a deep comparison of the old
      // data to the new data, which is expensive for large datasets.  Don't
      // use .set for data or dataMinMax to avoid this overhead.
      self.data = {};  // Map from channelName to data.
      self.dataMinMax = {};  // Map from channelName to data.
      var tabId = args.tabId;
      self.clientId = tabId + '-graph-' + args.id;
      _.bindAll(self, 'destroy', 'updateCacheSubscription', 'changeVisibleTime',
          'addChannel', 'removeChannel', 'updateSampleSet');
      App.subscribe('HideVehicle-' + tabId, self.destroy);
      App.subscribe('VisibleTimeChange-' + tabId, self.changeVisibleTime);
      App.subscribe('ChannelRequested-' + tabId + '-' + args.id,
          self.addChannel);
      if (args.master)
        App.subscribe('ChannelRequested-' + tabId, self.addChannel);
      App.subscribe('ChannelUnrequested-' + tabId, self.removeChannel);
      App.sampleCache.bind('update-' + self.clientId,
          self.updateSampleSet);
      self.view.bind('ChannelUnrequested', self.removeChannel);
      self.view.bind('VisibleTimeChange', function (beg, end) {
        self.updateCacheSubscription();
        App.publish('VisibleTimeChange-' + tabId, [beg, end]);
      });
      self.view.bind('VisibleWidthChange', self.updateCacheSubscription);
      self.view.render();
      return self;
    },

    destroy: function () {
      var self = this, tabId = self.get('tabId');
      App.unsubscribe('HideVehicle-' + tabId, self.destroy);
      App.unsubscribe('VisibleTimeChange-'+ tabId, self.changeVisibleTime);
      App.unsubscribe('ChannelRequested-'+ tabId + '-' + self.get('id'),
                      self.addChannel);
      if (self.get('master'))
        App.unsubscribe('ChannelRequested-' + tabId, self.addChannel);
      App.unsubscribe('ChannelUnrequested-' + tabId, self.removeChannel);
      App.sampleCache.unbind('update-' + self.clientId, self.updateSampleSet);
      App.sampleCache.endClient(self.clientId);
      self.view.destroy();
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
      viewRange = expandRange(viewRange, 0.2);
      // When necessary to fetch more data, fetch twice as much as necessary,
      // so we can scroll and zoom smoothly without excessive redrawing.
      if (this.prevDur != dur || this.prevRange == null ||
          this.prevRange.beg > viewRange.beg ||
          this.prevRange.end < viewRange.end) {
        // Either duration has changed, or the new view does not overlap the
        // data we've already fetched.
        this.prevDur = dur;
        this.prevRange = expandRange(viewRange, 0.5);
      }
      App.sampleCache.setClientView(
          this.clientId, this.get('vehicleId'),
          _.pluck(this.get('channels'), 'channelName'),
          dur, this.prevRange.beg, this.prevRange.end);
    },

    changeVisibleTime: function (beg, end) {
      this.view.setVisibleTime(beg, end);
    },

    addChannel: function (channels) {
      var self = this;
      channels = _.isArray(channels) ? channels : [channels];
      _.each(channels, function (channel) {
        if (_.pluck(self.get('channels'), 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        channel = _.clone(channel);
        var usedColors = _.pluck(self.get('channels'), 'colorNum');
        for (var c = 0; _.include(usedColors, c); ++c) { }
        channel.colorNum = c;
        self.get('channels').push(channel);
        console.log('addChannel(', channel, ')...');
      });
      self.updateCacheSubscription();
      return self;
    },

    removeChannel: function (channel) {
      var self = this;
      var index = _.pluck(self.get('channels'), 'channelName')
          .indexOf(channel.channelName);
      if (index === -1) return;
      self.get('channels').splice(index, 1);
      console.log('removeChannel(', channel, ')...');
      self.view.trigger('channelRemoved', channel);
      self.updateCacheSubscription();
      return self;
    },

    updateSampleSet: function (sampleSet) {
      var self = this;
      var data = {}, dataMinMax = {};
      self.get('channels').forEach(function(channel) {
        var samples = sampleSet[channel.channelName] || [];
        var channelData = data[channel.channelName] = [];
        var channelMinMaxData = dataMinMax[channel.channelName] = [];
        var prevEnd = null, prevMinMaxEnd = null;
        _.each(samples, function (s, i) {
          if (prevEnd != s.beg)
            channelData.push(null);
          channelData.push([s.beg / 1000, s.val]);
          if (s.end !== s.beg)
            channelData.push([s.end / 1000, s.val]);
          prevEnd = s.end;
          if (s.min != null || s.max != null) {
            if (prevMinMaxEnd != s.beg)
              channelMinMaxData.push(null);
            var max = s.max == null ? s.val : s.max;
            var min = s.min == null ? s.val : s.min;
            channelMinMaxData.push([s.beg / 1000, max, min]);
            if (s.end !== s.beg)
              channelMinMaxData.push([s.end / 1000, max, min]);
            prevMinMaxEnd = s.end;
          }
        });
      });
      self.data = data;
      self.dataMinMax = dataMinMax;
      self.view.draw();
      // TODO: fix this, Sander
      self.view.resize();
    },


  });
});

