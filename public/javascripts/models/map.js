/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  var latChan = 'gps.latitude_deg', lngChan = 'gps.longitude_deg';
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.tabModel = args.tabModel;
      this.view = new App.views.MapView(args);
      this.view.render({ waiting: true });
      _.bindAll(this, 'destroy', 'mouseHoverTime', 'updateVisibleSampleSet',
          'updateNavigableSampleSet');
      this.clientIdVisible = args.tabId + '-map-visible';
      this.clientIdNavigable = args.tabId + '-map-navigable';
      App.subscribe('VehicleUnrequested-' + args.tabId, this.destroy);
      this.visibleTimeChanged =
          _.bind(this.timeChanged, this, this.clientIdVisible);
      this.tabModel.bind('change:visibleTime', this.visibleTimeChanged);
      this.navigableTimeChanged =
          _.bind(this.timeChanged, this, this.clientIdNavigable);
      this.tabModel.bind('change:navigableTime', this.navigableTimeChanged);
      App.subscribe('MouseHoverTime-' + args.tabId, this.mouseHoverTime);
      App.sampleCache.bind('update-' + this.clientIdVisible,
          this.updateVisibleSampleSet);
      App.sampleCache.bind('update-' + this.clientIdNavigable,
          this.updateNavigableSampleSet);
      this.timeChanged(this.clientIdVisible, null,
                       this.tabModel.get('visibleTime'));
      this.timeChanged(this.clientIdNavigable, null,
                       this.tabModel.get('navigableTime'));
      return this;
    },

    destroy: function () {
      var tabId = this.get('tabId');
      App.unsubscribe('VehicleUnrequested-' + tabId, this.destroy);
      this.tabModel.unbind('change:visibleTime', this.visibleTimeChanged);
      this.tabModel.unbind('change:navigableTime', this.navigableTimeChanged);
      App.unsubscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
      App.sampleCache.unbind('update-' + this.clientIdVisible,
          this.updateVisibleSampleSet);
      App.sampleCache.endClient(this.clientIdVisible);
      App.sampleCache.unbind('update-' + this.clientIdNavigable,
          this.updateNavigableSampleSet);
      App.sampleCache.endClient(this.clientIdNavigable);
    },

    timeChanged: function(clientId, model, timeRange) {
      var maxSamples = 5000;  // Maximum latlngs to target.
      var beg = timeRange.beg, end = timeRange.end;
      // TODO: For views which include a lot of time with no gps data, we fetch
      // very few points.  We could get clever and use the _schema time ranges
      // for gps data to use the time range which overlaps [beg,end) rather
      // than (end - beg).
      var validRanges = null;
      App.publish('FetchChannelInfo-' + this.get('vehicleId'),
                  [latChan, function(desc) {
        if (desc) validRanges = desc.valid;
      }]);
      var visibleDuration = 0;
      (validRanges || []).forEach(function(range) {
        var delta = Math.min(range.end, end) - Math.max(range.beg, beg);
        if (delta > 0) visibleDuration += delta;
      });
      if (visibleDuration <= 0) visibleDuration = end - beg;
      var dur = App.sampleCache.getBestDuration(visibleDuration, maxSamples);
      App.sampleCache.setClientView(clientId, this.get('vehicleId'),
                                    [ latChan, lngChan ], dur, beg, end);
      // TODO: cell dots?
    },

    mouseHoverTime: function(time) {
      var pointsVisible = this.pointsVisible || [];
      var pointsNavigable = this.pointsNavigable || [];
      function locForTime(points) {
        // TODO: binary search for speed.
        for (var i in points) {
          var p = points[i];
          if (p.beg <= time && time < p.end)
            return p;
        }
        return null;
      }
      this.set({ cursorPoint:
          locForTime(pointsVisible) || locForTime(pointsNavigable) });
      this.view.draw({ noPointsChange: true });
    },

    updateVisibleSampleSet: function (sampleSet) {
      this.pointsVisible = this.sampleSetToPoints(sampleSet);
      this.view.draw();
    },

    updateNavigableSampleSet: function (sampleSet) {
      this.pointsNavigable = this.sampleSetToPoints(sampleSet);
      this.view.draw();
    },

    sampleSetToPoints: function(sampleSet) {
      var split = App.shared.splitSamplesByTime(sampleSet);
      var points = [];
      split.forEach(function (p) {
        var lat = p.val[latChan], lng = p.val[lngChan];
        if (lat != null && lng != null)
          points.push({ beg: p.beg, end: p.end, lat: lat.val, lng: lng.val });
      });
      return points;
    },

  });
});

