/*!
 * Copyright 2011 Mission Motors
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'views/home',
  'views/graph'
], function ($, _, Backbone, mps, util, Home, Graph) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Page routes:
      this.route(':username/:did/:channel', 'graph', this.graph);
      this.route('', 'home', this.home);
    },

    routes: {
      // Catch all:
      '*actions': 'default'
    },

    home: function () {
      if (this.page)
        this.page.destroy();
      this.page = new Home(this.app).render();
    },

    graph: function (username, did, channel) {
      if (this.page)
        this.page.destroy();

      this.page = new Graph(this.app, {
        vehicleId: did,
        channel: channel,
        visibleTime: {
          beg: util.getParameterByName('b'),
          end: util.getParameterByName('e')
        }
      }).render();
    }

    // query: function (str) {
    //   // Kills everything and loads all content from scratch.

    //   App.publish('KillallTabs');
    //   App.publish('ShowFolderItem-dashboard');
    //   App.stateMonitor.resetState();
    //   App.stateMonitor.setState(str);
    // },

    // vehicle: function (id, q) {
    //   var tab = $('[data-id="' + id + '"]');
    //   if (tab.length !== 0) {
    //     var tabId = tab.data('tabTarget')
    //                 .substr(tabId.indexOf('-') + 1);
    //     mps.publish('ShowFolderItem-target-' + tabId);
    //   } else {
    //     var tr = $('#vehicle_' + id);
    //     var items = tr.attr('id').split('_');
    //     var time = parseInt($('[data-time]', tr).attr('data-time'));
    //     var title = tr.attr('data-title');
    //     var lastCycle = time === 0 ? null :
    //         JSON.parse($('[data-cycle]', tr).attr('data-cycle'));
    //     var tabId = App.util.makeId();
    //     var timeRange = { beg: lastCycle.beg, end: lastCycle.end };
    //     mps.publish('VehicleRequested', 
    //                 [Number(id), tabId, title, timeRange, false]);
    //   }
    // },

  });

  return Router;
});
