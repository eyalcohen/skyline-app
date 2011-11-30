/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.Router.extend({

    initialize: function(options) {
      this.updateURLTime = _.debounce(this.updateURLTime, 500);
      this.route(/^vehicle\/([0-9]+)(?:\?(.*))?/, 'vehicle', this.vehicle);
      this.route(/^state\/([A-Za-z0-9]{5})/, 'state', this.state);      
      // Heuristically filter the matches to reduce
      // likelihood of an invalid app state.
      this.route(/^\?([A-Za-z0-9]{5}\..*)/, 'query', this.query);
    },

    routes: {
      '': 'dashboard',
    },

    go: function (frag, vehicleId, opts) {
      var lastTime = App.stateMonitor.getVehicleTime(vehicleId);
      this.navigate(frag, opts);
      this.updateURLTime(lastTime.beg, lastTime.end);
    },

    query: function (str) {
      // Brutally kills everything and
      // loads all content from scratch.
      // TODO: Be nicer.
      App.publish('KillallTabs');
      App.publish('ShowFolderItem-dashboard');
      App.stateMonitor.resetState();
      App.stateMonitor.setState(str);
    },

    dashboard: function () {
      App.publish('ShowFolderItem-dashboard');
    },

    vehicle: function (id, q) {
      var urlTime = q ? this.parseURLTime(q) : null;
      var tab = $('[data-id="' + id + '"]');
      if (tab.length !== 0) {
        var tabId = tab.data('tabTarget');
        var tabModel = App.vehicleTabModels[tabId];
        App.publish('ShowFolderItem-' + tabId);
        if (urlTime)
          tabModel.set({ visibleTime: urlTime });
      } else {
        var tr = $('#vehicle_' + id);
        var items = tr.attr('id').split('_');
        var time = parseInt($('[data-time]', tr).attr('data-time'));
        var title = tr.attr('data-title');
        var lastCycle = time === 0 ? null :
            JSON.parse($('[data-cycle]', tr).attr('data-cycle'));
        var tabId = App.util.makeId();
        var timeRange = urlTime || { beg: lastCycle.beg, end: lastCycle.end };
        App.publish('VehicleRequested',
                    [Number(id), tabId, title, timeRange]);
      }
    },

    state: function (key) {
      App.publish('KillallTabs');
      var state = $('#main').data('state');
      if (!state || state.substr(0, 1) === '!') {
        window.location = window.location.href;
        return;
      }
      App.stateMonitor.resetState();
      App.stateMonitor.setState(state);
    },

    parseURLTime: function (str) {
      var frags = str.split('&');
      var beg, end, dur;
      _.each(frags, function (f) {
        var parms = f.split('=');
        var k = parms[0];
        var v = parms[1];
        var nv = Number(parms[1]);
        switch (k) {
          case 'beg':
            beg = isNaN(nv) ? getTime(v) : nv;
            break;
          case 'end':
            end = isNaN(nv) ? getTime(v) : nv;
            break;
          case 'dur':
            dur = isNaN(nv) ? getDuration(v) : nv;
            break;
        }
      });

      /*!
       * Checks for time shortcuts.
       * month.day.year.hour.minute.second.millisecond
       * (11.29.2001, 6.24.2009.2.34.52.100)
       */
      function getTime(s) {
        var segs = _.map(s.split('.'), function (seg) {
          return Number(seg); });
        var month = segs[0] || 0;
        var day = segs[1] || 0;
        var year = segs[2] || 0;
        var hour = segs[3] || 0;
        var min = segs[4] || 0;
        var sec = segs[5] || 0;
        var msec = segs[6] || 0;
        var date = new Date(year, month-1, day, hour, min, sec, msec);
        return date.getTime() * 1000;
      }

      /*!
       * Checks for duration shortcuts.
       * (2d, 1h, 12m, 2m2.4s, 20ms, 1d2h3m21.5s100ms)
       */
      function getDuration(s) {
        var day = getDurationVal('d');
        var hour = getDurationVal('h');
        var min = getDurationVal('m');
        var sec = getDurationVal('s');
        var msec = getDurationVal('ms');
        function getDurationVal(del) {
          var val = '';
          var i = s.indexOf(del) - 1;
          (function () {
            var c = s.charAt(i);
            if (c && (!isNaN(Number(c)) || c === '.')) {
              val = c + val;
              --i;
              arguments.callee.call();
            }
          })();
          return val !== '' ? Number(val) : 0;
        }
        return 1000 * (1000 * (60 * (60 * ((24 *
                day) + hour) + min) + sec)) + msec;
      }

      if (beg)
        return dur ? { beg: beg, end: beg + dur } :
              (end ? { beg: beg, end: end } : false);
      else return false;
    },

    updateURLTime: function (beg, end) {
      var timeStr = '?beg=' + beg + '&dur=' + (end - beg);
      this.navigate(window.location.pathname +
                    timeStr, { replace: true });
    },

  });
});

