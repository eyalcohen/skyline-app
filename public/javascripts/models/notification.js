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
            icon: 'graphics/drive.png',
            desc: 'Cycle',
            note: args.val.drive_km + ' km' + ', '
                + args.val.drive_kWh + ' kWh',
          });
          break;
        case '_charge':
          _.extend(this.attributes, {
            icon: 'graphics/charge.png',
            desc: 'Charge',
            note: args.val.charge_kWh + ' kWh' + ', ' +
                args.val.wall_A + ' A, ' + args.val.wall_V + ' V',
          });
          break;
        case '_error':
          _.extend(this.attributes, {
            icon: 'graphics/error.png',
            desc: 'Error',
            note: args.val.humanName,
          });
          break;
        case '_warning':
          _.extend(this.attributes, {
            icon: 'graphics/warning.png',
            desc: 'Fault',
            note: args.val.humanName,
          });
          break;
      }
      return this;
    }
  });
});

