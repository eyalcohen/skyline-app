/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.Router.extend({

    initialize: function(options) {
      this.updateURLTime = _.debounce(this.updateURLTime, 500);
      this.route(/^vehicle\/([0-9]+)(?:\?(.*))?/, 'vehicle', this.vehicle);
      // Heuristically filter the matches to reduce
      // likelihood of an invalid app state.
      this.route(/^\?([A-Za-z0-9]{5}\..*)/, 'query', this.query);
    },

    routes: {
      '': 'query',
    },

    query: function (str) {
      // Kills everything and
      // loads all content from scratch.
      // TODO: Be nicer.
      App.publish('KillallTabs');
      App.publish('ShowFolderItem-dashboard');
      App.stateMonitor.resetState();
      App.stateMonitor.setState(str);
    },

    vehicle: function (id, q) {
      var tab = $('[data-id="' + id + '"]');
      if (tab.length !== 0) {
        var tabId = tab.data('tabTarget')
                    .substr(tabId.indexOf('-') + 1);
        App.publish('ShowFolderItem-target-' + tabId);
      } else {
        var tr = $('#vehicle_' + id);
        var items = tr.attr('id').split('_');
        var time = parseInt($('[data-time]', tr).attr('data-time'));
        var title = tr.attr('data-title');
        var lastCycle = time === 0 ? null :
            JSON.parse($('[data-cycle]', tr).attr('data-cycle'));
        var tabId = App.util.makeId();
        var timeRange = { beg: lastCycle.beg, end: lastCycle.end };
        App.publish('VehicleRequested', 
                    [Number(id), tabId, title, timeRange, false]);
      }
    },

  });
});

