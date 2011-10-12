/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery',
   'jquery-extensions'],
   function ($) {
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
      $('.tabs, .folder').hide();
      return this;
    },

    load: function (vehicleId, vehicleTitle, timeRange) {
      var targetClass = 'target-' + this.makeid();
      new App.views.VehicleView().render({
        title: vehicleTitle,
        targetClass: targetClass,
        vehicleId: vehicleId,
        timeRange: timeRange,
        active: true,
      }, 'vehicle.jade');
    },

    makeid: function () {
      var text = '';
      var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
          'abcdefghijklmnopqrstuvwxyz0123456789';
      for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(
              Math.random() * possible.length));
      return text;
    },

  });
});
