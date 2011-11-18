/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({

    initialize: function (args) {
      _.bindAll(this, 'resize', 'destroy', 'startHistory', 'loadVehicle');
      this.startHistory = _.after(2, _.once(this.startHistory));
      App.subscribe('AppReady', this.startHistory);
      App.subscribe('NotAuthenticated', this.destroy);
      App.subscribe('VehicleRequested', this.loadVehicle);
      $(window).resize(_.debounce(function (e) {
        App.publish('WindowResize');
      }, 100));
      return this;
    },

    events: {
      'resize window': 'resize',
    },

    render: function () {
      App.dashView = new App.views.DashView({
        targetClass: 'dashboard',
      }).render({
        title: 'Dashboard',
        active: true,
        tabClosable: false,
        left: 30
      }, 'dash.jade');
      App.editorView = new App.views.EditorView().render();
      $('.tabs, .folder').show();
    },

    resize: function (e) {
      App.publish('WindowResize');
      return this;
    },

    destroy: function () {
      App.unsubscribe('AppReady', this.startHistory);
      App.unsubscribe('NotAuthenticated', this.destroy);
      App.unsubscribe('VehicleRequested', this.load);
      $('.tabs, .folder').hide();
      return this;
    },

    startHistory: function () {
      Backbone.history.start({
        pushState: true,
      });
    },

    loadVehicle: function (vehicleId, tabId, vehicleTitle, timeRange, hide) {
      var targetClass = 'target-' + tabId;
      var active = hide ? false : true;
      new App.views.VehicleView({
        targetClass: targetClass,
      }).render({
        tabId: tabId,
        title: vehicleTitle,
        vehicleId: vehicleId,
        timeRange: timeRange,
        active: active,
      }, 'vehicle.jade');
    },

  });
});
