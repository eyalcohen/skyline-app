/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      // Attributes of note to other models:
      //   visibleTime.beg, visibleTime.end: current visible time range, in us.
      //   navigableTime.beg, navigableTime.end: current navigator time range.
      //   highlightedChannel: name of channel to highlight
      this.set({ highlightedChannel: null });

      this.tabId = args.tabId;
      this.vehicleId = args.vehicleId;
      this.targetClass = args.targetClass;

      App.vehicleTabModels[this.tabId] = this;

      _.bindAll(this, 'destroy', 'addGraph', 'removeGraph');
      App.subscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.subscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      App.subscribe('VehicleUnrequested-' + this.tabId, this.destroy);

      // This is purely for the benefit of StateMonitor.
      this.bind('change:visibleTime', function(model, visibleTime) {
        App.publish('VisibleTimeChange-' + this.tabId,
                    [ visibleTime.beg, visibleTime.end ]);
      });

      this.view = new App.views.VehicleTabView(args);
      this.view.render(args, 'vehicle.jade');

      this.modelArgs = {
        tabModel: this,
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        target: this.targetClass,
        bottomPad: 0,
        singleVehicle: true,
        notifications: [],
      };

      this.graphModels = [];

      this.treeModel = new App.models.TreeModel(_.extend({}, this.modelArgs, {
        title: 'Available Channels',
        parent: '.' + this.targetClass + ' div .dashboard-left .top',
        height: 40,
      }));
      this.treeModel.fetch();

      this.mapModel = new App.models.MapModel(_.extend({}, this.modelArgs, {
        title: 'Location',
        parent: '.' + this.targetClass + ' div .dashboard-left .bottom',
        height: 60,
      })).bind('change:notifications', function () {
        // this.view.render();
      });

      this.eventsModel = new App.models.EventsModel(_.extend({}, this.modelArgs, {
        title: 'Vehicle Events',
        parent: '.' + this.targetClass + ' div .dashboard-right .bottom',
        height: 30,
      })).bind('change:notifications', function () {
        this.view.render();
      });

      this.timelineModel =
          new App.models.TimelineModel(_.extend({}, this.modelArgs, {
        title: 'Timeline',
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        height: '40px',
      })).bind('change:notifications', function () {
        this.view.render();
      });

      this.notificationCollection = new App.collections.NotificationCollection(
          _.extend({}, this.modelArgs, {
        dependents: [this.graphModels, this.mapModel,
            this.eventsModel, this.timelineModel],
      })).bind('reset', function () {
        _.each(_.flatten(this.dependents), _.bind(function (dep) {
          if (this.models.length === 0)
            dep.trigger('change:notifications');
          else
            dep.set({ notifications: this.models });
        }, this));
      });
      this.notificationCollection.fetch();

      if (!App.stateMonitor.isRestoring)
        this.addGraph('MASTER');

      return this;
    },

    destroy: function () {
      App.unsubscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.unsubscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      App.unsubscribe('VehicleUnrequested-' + this.tabId, this.destroy);
      delete App.vehicleTabModels[this.tabId];
    },

    addGraph: function (id) {
      var isMaster = id == 'MASTER';
      var graphModel = new App.models.GraphModel(
            _.extend({}, this.modelArgs, {
        title: isMaster ? 'Graphs' : null,
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        height: 70,
        bottomPad: isMaster ? 63 : 0,
        id: id,
      })).bind('change:notifications', function () {
        if (this.view.plot)
          this.view.setupIcons();
      });
      this.graphModels.push(graphModel);
      this.view.arrangeGraphs();
      App.publish('WindowResize');
    },

    removeGraph: function (id) {
      var graphModel = _.find(this.graphModels, function (g) {
        return g.get('id') == id;
      });
      graphModel.destroy();
      this.graphModels = _.reject(this.graphModels, function (g) {
        return g.get('id') == id;
      });
      this.view.arrangeGraphs();
      App.publish('WindowResize');
    },

    resetNotifications: function () {
      this.notificationCollection.fetch();
    },

  });
});

