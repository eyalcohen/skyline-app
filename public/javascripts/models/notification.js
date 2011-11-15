/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if ('function' === typeof args)
        return false;
      if (!args || !args.beg || !args.end || !args.type || !args.val) {
        // throw new Error('InvalidConstructArgs');
        // return;
      }
      switch (args.type) {
        case '_drive':
          _.extend(this.attributes, {
            icon: '/graphics/marker.png',
            color: '#9dfbf3',
            desc: 'Cycle',
            note: args.val.drive_km + ' km' + ', '
                + args.val.drive_kWh + ' kWh',
          });
          break;
        case '_charge':
          _.extend(this.attributes, {
            icon: '/graphics/charge.png',
            color: '#9dfba0',
            desc: 'Charge',
            note: args.val.charge_kWh + ' kWh' + ', ' +
                args.val.wall_A + ' A, ' + args.val.wall_V + ' V',
          });
          break;
        case '_error':
          _.extend(this.attributes, {
            icon: '/graphics/error.png',
            color: '#fbaa9d',
            desc: 'Error',
            note: args.val.humanName,
          });
          break;
        case '_warning':
          _.extend(this.attributes, {
            icon: '/graphics/warning.png',
            color: '#f5fb9a',
            desc: 'Warning',
            note: args.val.humanName,
          });
          break;
      }
      if (args.vehicle) {
        this.set({
          htmlId: 'notification_' + args.vehicle._id,
        });
      }
      return this;
    }
  });
});

