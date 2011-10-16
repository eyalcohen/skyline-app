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
        data: {}, // Map from channelName to data.
        dataMinMax: {}, // Map from channelName to data.
        beg: null, end: null, // Viewed time range.
      });
      self.colorCnt = 0;
      self.clientId = args.vehicleId + '-graph-' + args.id;
      self.view.render();
      _.bindAll(self, 'destroy', 'updateCacheSubscription', 'changeVisibleTime',
          'addChannel', 'removeChannel', 'updateSampleSet');
      App.subscribe('HideVehicle-' + args.vehicleId, this.destroy);
      App.subscribe('VisibleTimeChange-' + args.vehicleId,
          self.changeVisibleTime);
      App.subscribe('ChannelRequested-' + args.vehicleId + '-' + args.id,
          self.addChannel);
      if (args.master)
        App.subscribe('ChannelRequested-' + args.vehicleId,
            self.addChannel);
      App.subscribe('ChannelUnrequested-' + args.vehicleId,
          self.removeChannel);
      App.sampleCache.bind('update-' + self.clientId,
          self.updateSampleSet);
      self.view.bind('ChannelUnrequested', self.removeChannel);
      self.view.bind('VisibleTimeChange', function (beg, end) {
        self.updateCacheSubscription();
        App.publish('VisibleTimeChange-' + args.vehicleId, [beg, end]);
      });
      self.view.bind('VisibleWidthChange', self.updateCacheSubscription);
      return self;
    },

    destroy: function () {
      App.unsubscribe('HideVehicle-' + this.get('vehicleId'),
          this.destroy);
      App.unsubscribe('VisibleTimeChange-'+
          this.get('vehicleId'), this.changeVisibleTime);
      App.unsubscribe('ChannelRequested-'+
          this.get('vehicleId') + '-' + this.get('id'), this.addChannel);
      if (this.get('master'))
        App.unsubscribe('ChannelRequested-' + this.get('vehicleId'),
            this.addChannel);
      App.unsubscribe('ChannelUnrequested-'+
          this.get('vehicleId'), this.removeChannel);
      App.sampleCache.unbind('update-'+
          this.clientId, this.updateSampleSet);
      App.sampleCache.endClient(this.clientId);
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
      if (_.isArray(channels))
        _.each(channels, function (c) {
          addChannelInternal(c);
        });
      else
        addChannelInternal(channels);
      self.view.draw();
      self.updateCacheSubscription();
      return self;
      function addChannelInternal(channel) {
        if (_.pluck(self.get('channels'), 'channelName')
            .indexOf(channel.channelName) !== -1)
          return;
        if (channel.colorNum === undefined)
          channel.colorNum = self.colorCnt;
        self.get('channels').push(channel);
        if (++self.colorCnt > 15)
          self.colorCnt = 0;
        console.log('addChannel(', channel, ')...');
      }
    },

    removeChannel: function (channel) {
      var self = this;
      var index = _.pluck(self.get('channels'), 'channelName')
          .indexOf(channel.channelName);
      if (index === -1) return;
      self.get('channels').splice(index, 1);
      console.log('removeChannel(', channel, ')...');
      self.view.draw();
      self.updateCacheSubscription();
      self.view.trigger('channelRemoved', channel);
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
      self.set({ data: data });
      self.set({ dataMinMax: dataMinMax });
      self.view.draw();
    },


  });
});

