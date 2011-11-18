/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.Router.extend({

    routes: {
      '': 'dashboard',
      'vehicle/:id': 'vehicle',
      'state/:key': 'state',
    },

    dashboard: function () {
      App.publish('ShowFolderItem-dashboard');
    },

    vehicle: function (id) {
      var tab = $('[data-id="' + id + '"]');
      if (tab.length !== 0) {
        var tabId = tab.data('tabTarget');
        App.publish('ShowFolderItem-' + tabId);
      } else {
        var tr = $('#vehicle_' + id);
        var items = tr.attr('id').split('_');
        var time = parseInt($('[data-time]', tr).attr('data-time'));
        var title = tr.attr('data-title');
        var lastCycle = time === 0 ? null :
            JSON.parse($('[data-cycle]', tr).attr('data-cycle'));
        var tabId = App.util.makeId();
        var timeRange = { beg: lastCycle.beg, end: lastCycle.end };
        App.publish('VehicleRequested', [Number(id), tabId, title, timeRange]);
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

    getTimeFromURL: function () {
      var str = window.location.search;
      if (str === '') return;
      var frags = str.substr(1).split('&'), time;
      _.each(frags, function (f) {
        var parms = f.split('=');
        if ('time' === parms[0])
          time = parms[1].split(',');
      });
      return time ? { beg: time[0], end: time[1] } : false;
    },

  });
});

