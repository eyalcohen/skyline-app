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
        labels: [],
        colors: [],
        units: [],
        data: {},  // Map from channelName to data.
        dataMinMax: {},  // Map from channelName to data.
        beg: null, end: null,  // Viewed time range.
      });
      self.colorCnt = 0;
      self.clientId = args.vehicleId + '-graph';  // TODO: graph #?
      console.log('Graph Model...');
      self.view.render({ });
      _.bindAll(self, 'updateCacheSubscription', 'changeVisibleTime',
                'addChannel', 'updateSampleSet');
      App.subscribe('VisibleTimeChange-' + args.vehicleId, self.changeVisibleTime);
      App.subscribe('ChannelRequested-' + args.vehicleId, self.addChannel);
      App.sampleCache.bind('update-' + self.clientId, self.updateSampleSet);
      self.view.bind('VisibleTimeChange', function(beg, end) {
        self.updateCacheSubscription();
        App.publish('VisibleTimeChange-' + args.vehicleId, [beg, end]);
      });
      self.view.bind('VisibleWidthChange', self.updateCacheSubscription);
      return self;
    },

    destroy: function() {
      App.sampleCache.unbind('update-' + this.clientId, this.updateSampleSet);
      App.sampleCache.endClient(this.clientId);
    },

    updateCacheSubscription: function() {
      console.log('Updating cache subscription.');
      var viewRange = this.view.getVisibleTime();
      if (!viewRange) return;
      // When the tab holding the graph is hidden, the graph width becomes
      // negative!  Some heuristics to avoid fetching unnecessary amounts of
      // data.
      if (viewRange.width <= 0) return;
      viewRange.width = Math.max(viewRange.width, 2000);
      var dur = App.sampleCache.getBestGraphDuration(
          (viewRange.end - viewRange.beg) / viewRange.width);
      App.sampleCache.setClientView(
          this.clientId, this.attributes.vehicleId,
          _.pluck(this.attributes.channels, 'channelName'),
          dur, viewRange.beg, viewRange.end);
    },

    changeVisibleTime: function(beg, end) {
      console.log('changeVisibleTime.');
      this.view.setVisibleTime(beg, end);
    },

    addChannel: function(channel) {
      var self = this;
      self.get('channels').push(channel);
      var label = channel.units ?
          channel.title + ' (' + channel.units + ')' :
          channel.title;
      self.get('labels').push(label);
      self.get('colors').push(self.colorCnt);
      self.get('units').push(channel.units || '');
      if (++self.colorCnt > 4)
        self.colorCnt = 0;
      console.log('addChannel(', channel, ')...');
      self.view.draw();
      self.updateCacheSubscription();
    },

    updateSampleSet: function(sampleSet) {
      var self = this;
      var data = {}, dataMinMax = {};
      this.attributes.channels.forEach(function(channel) {
        var samples = sampleSet[channel.channelName] || [];
        // App.shared.mergeOverlappingSamples(samples);
        var channelData = data[channel.channelName] = [];
        var channelMinMaxData = dataMinMax[channel.channelName] = [];
        var prevEnd = null, prevMinMaxEnd = null;
        _.each(sampleSet[channel.channelName] || [], function (s, i) {
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

    /*
    fetch: function (channel, timeRange) {
      var clear = this.get('data').length === 0;
      if (clear)
        this.view.render({ loading: true });
      var points = [], self = this;
      App.api.fetchSamples(self.attributes.vehicleId, channel.channelName, timeRange,
          function (err, channelData) {
        if (err) {
          throw err;
          return;
        }
        if (!channelData || channelData.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId +
                       ' has no '+ channel.channelName +
                       ' data for the time range requested.');
          if (clear)
            self.view.render({ empty: true });
        } else {
          var data = [];
          _.each(channelData, function (pnt) {
            data.push([pnt.beg / 1000, pnt.val]);
            if (pnt.end !== pnt.beg)
              data.push([pnt.end / 1000, pnt.val]);
          });
          App.shared.mergeOverlappingSamples(data);
          self.get('data').push(data);
          var label = channel.units ?
              channel.title + ' (' + channel.units + ')' :
              channel.title;
          self.get('labels').push(label);
          self.get('units').push(channel.units || '');
          self.get('colors').push(self.colorCnt);
          if (self.get('data').length > 2) {
            self.get('data').shift();
            self.get('labels').shift();
            self.get('units').shift();
            self.get('colors').shift();
          }
          if (clear) {
            self.view.render({}, function () {
              self.view.draw({ range: timeRange });
            });
          } else {
            self.view.draw({ range: timeRange });
          }
          self.colorCnt++;
          if (self.colorCnt > 4)
            self.colorCnt = 0;
        }
      });

      return this;
    },
    */

  });
});

