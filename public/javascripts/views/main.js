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

      var self = this;
      self.windowHeight = $(window).height();
      $(window).resize(_.debounce(function (e) {
        var wh = $(window).height();
        App.publish('WindowResize', [wh - self.windowHeight]);
        self.windowHeight = wh;
      }, 100));
      return this;
    },

    events: {
      'resize window': 'resize',
    },

    render: function () {
      App.dashTabModel = new App.models.DashTabModel({
        targetClass: 'dashboard',
      });
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
      App.unsubscribe('VehicleRequested', this.loadVehicle);
      $('.tabs, .folder').hide();
      return this;
    },

    startHistory: function () {
      Backbone.history.start({
          pushState: true,
      });
    },

    loadVehicle: function (vehicleId, tabId, vehicleTitle, visibleTime, hide, cb) {
      var targetClass = 'target-' + tabId;
      var active = hide ? false : true;
      new App.models.VehicleTabModel({
        targetClass: targetClass,
        tabId: tabId,
        title: vehicleTitle,
        vehicleId: vehicleId,
        visibleTime: visibleTime,
        active: active,
        channelTreeLoaded: cb,
      });
    },

  });
});
