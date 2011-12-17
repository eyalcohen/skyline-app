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

  getRelativeTime: function (ts) {
    var parsedDate = new Date(Math.round(ts));
    var relativeDate = arguments.length > 1 ? arguments[1] : new Date();
    var delta = (relativeDate.getTime() - parsedDate.getTime()) / 1e3;
    if (delta < 5) return 'just now';
    else if (delta < 15) return 'just a moment ago';
    else if (delta < 30) return 'just a few moments ago';
    else if (delta < 60) return 'less than a minute ago';
    else if (delta < 120) return 'about a minute ago';
    else if (delta < (45 * 60))
      return (parseInt(delta / 60)).toString() + ' minutes ago';
    else if (delta < (90 * 60))
      return 'about an hour ago';
    else if (delta < (24 * 60 * 60)) {
      var h = (parseInt(delta / 3600)).toString();
      if (h != '1') return 'about ' + h + ' hours ago';
      else return 'about an hour ago';
    }
    else if (delta < (2 * 24 * 60 * 60))
      return 'about a day ago';
    else if (delta < (10 * 24 * 60 * 60))
      return (parseInt(delta / 86400)).toString() + ' days ago';
    else return this.toLocaleString(new Date(ts), 'm/d/yy h:MM TT Z');
  },

  getDuration: function (delta) {
    delta = parseFloat(delta) / 1e6;
    if (delta === 0)
      return 'n / a';
    if (delta < 1)
      return (delta * 1e3).toFixed(1) + ' milliseconds';
    else if (delta < 60)
      return delta.toFixed(1) + ' seconds';
    else if (delta < (45 * 60)) 
      return (delta / 60).toFixed(1) + ' minutes';
    else if (delta < (24 * 60 * 60))
      return (delta / 3600).toFixed(1) + ' hours';
    else
      return (delta / 86400).toFixed(1) + ' days';
  },

  toLocaleString: function (utcDate, mask) {
    var time = utcDate.getTime();
    var zone = this.getTimeZone();
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

  getBlurb: function (str, max) {
    if (str.length < max)
      return str;
    var blurb = '';
    var words = str.split(' ');
    var end = ' ...';
    var i = 0;
    max -= end.length;
    do {
      blurb = blurb.concat(words[i], ' ');
      ++i;
    } while (blurb.concat(words[i]).length - 1 < max);
    return blurb.substr(0, blurb.length - 1) + end;
  },

});






