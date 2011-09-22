/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.NavigatorView(args);
      this.view.render({ waiting: true });
      this.set({
        data: [],
        timeLength: 86400 * 7 * 4 * 2 * 1000, // one month - not used, just fetching all
      });
      _.bindAll(this, 'fetch');
      return this;
    },

    fetch: function (timeRange) {
      var clear = this.get('data').length === 0,
          points = [], self = this;
      if (clear) {
        this.view.render({ loading: true });
      }
      if (!timeRange) {
        // var now = new Date().getTime();
        // timeRange = {
        //   beginTime: now - self.get('timeLength'),
        //   endTime: now,
        // };
        timeRange = {};
      }
      self.set({ timeRange: timeRange });
      Step(
        function () {
          App.api.fetchSamples(self.attributes.vehicleId, 
                '_drive', timeRange, this.parallel());
          App.api.fetchSamples(self.attributes.vehicleId, 
                '_charge', timeRange, this.parallel());
          App.api.fetchSamples(self.attributes.vehicleId, 
                '_error', timeRange, this.parallel());
          App.api.fetchSamples(self.attributes.vehicleId, 
                '_warning', timeRange, this.parallel());
        },
        function (err, drivePnts, chargePnts, errorPnts, warningPnts) {
          if (err) {
            throw err;
            return;
          }
          if (!drivePnts || drivePnts.length === 0 &&
                !chargePnts || chargePnts.length === 0 &&
                !errorPnts || errorPnts.length === 0 &&
                !warningPnts || warningPnts.length === 0) {
            console.warn('Vehicle with id ' + self.attributes.vehicleId + ' has no '+
                'notifications for the time range requested.');
            if (clear)
              self.view.render({ empty: true });
          } else {
            App.shared.mergeOverlappingSamples(drivePnts);
            App.shared.mergeOverlappingSamples(chargePnts);
            App.shared.mergeOverlappingSamples(errorPnts);
            App.shared.mergeOverlappingSamples(warningPnts);
            self.set({
              data: [].concat(drivePnts, chargePnts, errorPnts, warningPnts),
              bounds: [
                _.min([].concat(_.pluck(drivePnts, 'beg'),
                    _.pluck(chargePnts, 'beg'),
                    _.pluck(errorPnts, 'beg'),
                    _.pluck(warningPnts, 'beg'))),
                _.max([].concat(_.pluck(drivePnts, 'end'),
                    _.pluck(chargePnts, 'end'),
                    _.pluck(errorPnts, 'end'),
                    _.pluck(warningPnts, 'end')))
              ],
            });
            if (clear) {
              self.view.render({}, function () {
                self.view.draw();
              });
            } else {
              self.view.draw();
            }
          }
        }
      );
      return this;
    },

  });
});

