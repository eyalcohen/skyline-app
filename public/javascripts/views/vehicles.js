/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click [value="Open"]': 'open',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        rows: this.collection.models,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('vehicles.dash.jade', opts).appendTo(App.regions.right);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    open: function (e) {
      e.preventDefault();
      var id = this.getId(e);
      var title = $(e.target).parent().parent().attr('data-title');
      // App.api.fetchSamples(App.user, id, '_wake', {},
      //     function (err, wakePeriods) {
      //   if (err) {
      //     throw err;
      //     return;
      //   }
      //   if (!wakePeriods || wakePeriods.length === 0) {
      //     console.warn('Vehicle with id ' + id + ' has not been seen before.');
      //     return;
      //   } else {
      //     App.shared.mergeOverlappingSamples(wakePeriods);
      //   }
      // 
      //   var len = wakePeriods.length, i = 1;
      //   do {
      //     var range = {
      //       beginTime: wakePeriods[len - i].beg,
      //       endTime: wakePeriods[len - i].end
      //     };
      //     i++;
      //     if (i > len) {
      //       console.warn('Vehicle with id ' + id + ' has no valid data available.');
      //       return;
      //     }
      //   } while (range.endTime - range.beginTime <= 0);
      // 
      //   App.api.fetchSamples(App.user, id, '_schema', {},
      //       function (err, schema) {
      //     if (err) {
      //       throw err;
      //       return;
      //     }
      //     if (!schema || schema.length === 0) {
      //       console.warn('Vehicle with id ' + id + ' has no data available.');
      //       return;
      //     } else {
      //       var names = _.pluck(_.pluck(schema, 'val'), 'channelName');
      //       
      //     }
      //   });
      // });
      // App.publish('VehicleRequested', [id, range, names, title]);
      App.publish('VehicleRequested', [id, title]);
      // 
      return this;
    },

  });
});

