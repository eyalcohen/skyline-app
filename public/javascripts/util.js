/*!
 * Copyright 2011 Mission Motors
 */

define({

  makeId: function () {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
        'abcdefghijklmnopqrstuvwxyz0123456789';
    for( var i=0; i < 5; i++ )
      text += possible.charAt(Math.floor(
            Math.random() * possible.length));
    return text;
  },

  newFilledArray: function (len, val) {
    var rv = new Array(len);
    while (--len >= 0) rv[len] = val;
    return rv;
  },

  toLocaleString: function (utcDate, mask) {
    var time = utcDate.getTime();
    var zone = this.getTimeZone();
    // var localDate = new Date((3600000 * zone) + time);
    var localDate = new Date(time);
    return localDate.format(mask);
  },

  getTimeZone: function () {
    var rightNow = new Date();
    var jan1 = new Date(rightNow.getFullYear(),
                        0, 1, 0, 0, 0, 0);
    var june1 = new Date(rightNow.getFullYear(),
                        6, 1, 0, 0, 0, 0);
    var temp = jan1.toGMTString();
    var jan2 = new Date(temp.substring(0,
                        temp.lastIndexOf(" ")-1));
    temp = june1.toGMTString();
    var june2 = new Date(temp.substring(0,
                        temp.lastIndexOf(" ")-1));
    var std_time_offset = (jan1 - jan2) / (1000 * 60 * 60);
    var daylight_time_offset = (june1 - june2) /
                              (1000 * 60 * 60);
    var dst;
    if (std_time_offset == daylight_time_offset) {
      // daylight savings time is NOT observed
      dst = false;
    } else { // positive is southern, negative is northern hemisphere
      var hemisphere = std_time_offset - daylight_time_offset;
      if (hemisphere >= 0)
        std_time_offset = daylight_time_offset;
      dst = true; // daylight savings time is observed
    }
    return dst ? std_time_offset + 1 : std_time_offset;
  },

});

