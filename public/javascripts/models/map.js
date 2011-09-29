/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  var latChan = 'gps.latitude_deg', lngChan = 'gps.longitude_deg';
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.MapView(args);
      this.view.render({ waiting: true });
      _.bindAll(this, 'changeVisibleTime',
                'updateVisibleSampleSet', 'updateNavigableSampleSet');
      App.subscribe('VisibleTimeChange-' + args.vehicleId,
                    this.changeVisibleTime);
      self.clientIdVisible = args.vehicleId + '-map-visible';
      App.sampleCache.bind('update-' + this.clientIdVisible,
                           this.updateVisibleSampleSet);
      self.clientIdNavigable = args.vehicleId + '-map-navigable';
      App.sampleCache.bind('update-' + this.clientIdNavigable,
                           this.updateNavigableSampleSet);
      return this;
    },

    destroy: function () {
      App.sampleCache.unbind('update-' + this.clientIdVisible,
                             this.updateVisibleSampleSet);
      App.sampleCache.endClient(this.clientIdVisible);
      App.sampleCache.unbind('update-' + this.clientIdNavigable,
                             this.updateNavigableSampleSet);
      App.sampleCache.endClient(this.clientIdVisible);
      // this.view.destroy();  ???
    },

    changeVisibleTime: function (beg, end) {
      var maxSamples = 2000;  // Maximum latlngs to target.
      // TODO: For views which include a lot of time with no gps data, we fetch
      // very few points.  We could get clever and use the _schema time ranges
      // for gps data to use the time range which overlaps [beg,end) rather
      // than (end - beg).
      var dur = App.sampleCache.getBestDuration(end - beg, maxSamples);
      App.sampleCache.setClientView(
          this.clientIdVisible, this.get('vehicleId'),
          [ latChan, lngChan ], dur, beg, end);
      // TODO: cell dots?
    },

    // TODO: changeNavigableTime

    updateVisibleSampleSet: function (sampleSet) {
      this.set({ pointsVisible: this.sampleSetToPoints(sampleSet) });;
      this.view.draw({ pointsVisibleChanged: true });
    },

    updateNavigableSampleSet: function (sampleSet) {
      this.set({ pointsNavigable: this.sampleSetToPoints(sampleSet) });;
      this.view.draw({ pointsNavigableChanged: true });
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

