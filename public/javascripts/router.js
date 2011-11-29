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
        App.publish('ShowFolderItem-' + tabId);
        if (urlTime)
          App.publish('VisibleTimeChange-' + tabId,
              [urlTime.beg, urlTime.end]);
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
        var v = Number(parms[1]);
        switch (k) {
          case 'beg': beg = v; break;
          case 'end': end = v; break;
          case 'dur': dur = v; break;
        }
      });
      if (!isNaN(beg) && !isNaN(dur))
        return { beg: beg, end: beg + dur };
      else if (!isNaN(beg) && !isNaN(end))
        return { beg: beg, end: end };
      else return false;
    },

    updateURLTime: function (beg, end) {
      var timeStr = '?beg=' + beg + '&dur=' + (end - beg);
      this.navigate(window.location.pathname +
                    timeStr, { replace: true });
    },

  });
});

