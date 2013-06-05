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
        left: 30,
      }, 'dash.jade');

      this.eventsModel = new App.models.EventsModel({
        title: 'Events',
        parent: '.dashboard .dashboard-left',
        events: [],
        singleVehicle: false,
        height: 'full',
      }).bind('change:events', function () {
        this.view.render();
      });

      this.eventCollection = new App.collections.EventCollection({
        dependents: [this.eventsModel],
      }).bind('reset', function () {
        _.each(this.dependents, _.bind(function (dep) {
          if (this.models.length === 0)
            dep.trigger('change:events');
          else
            dep.set({ events: this.models });
        }, this));
      });
      this.eventCollection.fetch();

      this.vehicleCollection = new App.collections.VehicleCollection({
        title: 'Vehicles',
        parent: '.dashboard .dashboard-right',
        height: 'full',
      });
      this.vehicleCollection.fetch();

      return this;
    },

    destroy: function () {},

  });
});

