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
      } else $('#vehicle_' + id + ' .open-vehicle').click();
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

  });
});

