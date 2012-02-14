/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if ('function' === typeof args)
        return false;
      // By including a reference to collection, the jade stuff ends up
      // traversing a large amount of unnecessary crud, taking a long time
      // (2+ seconds!) to generate the events list.  We don't need
      // the reference, so get rid of it.
      delete this.collection;

      switch (args.type) {
        case '_drive':
          this.attributes.meta = {
            icon: '/graphics/marker.png',
            color: '#9dfbf3',
            desc: 'Cycle',
            info: args.val.drive_km + ' km' + ', '
                + args.val.drive_kWh + ' kWh',
          };
          break;
        case '_charge':
          this.attributes.meta = {
            icon: '/graphics/charge.png',
            color: '#9dfba0',
            desc: 'Charge',
            info: args.val.charge_kWh + ' kWh' + ', ' +
                args.val.wall_A + ' A, ' + args.val.wall_V + ' V',
          };
          break;
        case '_error':
          this.attributes.meta = {
            icon: '/graphics/error.png',
            color: '#fbaa9d',
            desc: 'Error',
            info: args.val.humanName,
          };
          break;
        case '_warning':
          this.attributes.meta = {
            icon: '/graphics/warning.png',
            color: '#f5fb9a',
            desc: 'Warning',
            info: args.val.humanName,
          };
          break;
        case '_note':
          this.attributes.meta = {
            icon: '/graphics/paper.png',
            color: 'yellow',
            desc: 'Note',
            info: args.val.text,
          }
          break;
      }
      if (args.vehicle) {
        this.set({
          htmlId: 'event_' + args.vehicle._id,
        });
      }

      return this;
    }
  });
});

