/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery', 'jquery-extensions'], function ($) {
  return Backbone.View.extend({

    initialize: function (args) {
      _.bindAll(this, 'resize', 'destroy', 'load');
      App.subscribe('NotAuthenticated', this.destroy);
      App.subscribe('VehicleRequested', this.load);
      $(window).resize(_.debounce(function (e) {
        App.publish('WindowResize');
      }, 100));
      return this;
    },

    events: {
      'resize window': 'resize',
    },

    render: function () {
      $('.tabs, .folder').show();
    },

    resize: function (e) {
      App.publish('WindowResize');
      return this;
    },

    destroy: function () {
      App.unsubscribe('NotAuthenticated', this.destroy);
      App.unsubscribe('VehicleRequested', this.load);
      $('.tabs, .folder').hide();
      return this;
    },

    load: function (vehicleId, tabId, vehicleTitle, timeRange, hide) {
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
