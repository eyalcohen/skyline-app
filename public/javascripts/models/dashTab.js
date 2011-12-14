/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      this.targetClass = args.targetClass;

      this.view = new App.views.DashTabView(args);
      this.view.render({
        title: 'Dashboard',
        active: true,
        tabClosable: false,
        left: 30
      }, 'dash.jade');

      this.eventsModel = new App.models.EventsModel({
        title: 'Events',
        parent: '.dashboard-left',
        notifications: [],
        singleVehicle: false,
      }).bind('change:notifications', function () {
        this.view.render();
      });

      this.notificationCollection = new App.collections.NotificationCollection({
        dependents: [this.eventsModel],
      }).bind('reset', function () {
        _.each(this.dependents, _.bind(function (dep) {
          if (this.models.length === 0)
            dep.trigger('change:notifications');
          else
            dep.set({ notifications: this.models });
        }, this));
      });
      this.notificationCollection.fetch();

      this.vehicleCollection = new App.collections.VehicleCollection({
        title: 'Vehicles',
        parent: '.dashboard-right',
      });
      this.vehicleCollection.fetch();

      return this;
    },

    destroy: function () {},

  });
});

