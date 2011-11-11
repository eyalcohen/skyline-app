/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      return this;
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      this.tabId = opts.tabId;
      this.vehicleId = opts.vehicleId;
      this.targetClass = opts.targetClass;
      this.timeRange = opts.timeRange;
      this.treeModel = new App.models.TreeModel({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        title: 'Available Channels',
        parent: '.' + this.targetClass + ' div .dashboard-left .top',
        target: this.targetClass,
        height: 40,
        bottomPad: 0,
      }).fetch();
      this.graphModels = [new App.models.GraphModel({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        timeRange: this.timeRange,
        title: 'Graphs',
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        target: this.targetClass,
        height: 70,
        bottomPad: 63,
        id: 'MASTER',
      })];
      this.hookGraphControls(this.graphModels[0], 0);
      this.mapModel = new App.models.MapModel({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        timeRange: this.timeRange,
        title: 'Location',
        parent: '.' + this.targetClass + ' div .dashboard-left .bottom',
        target: this.targetClass,
        height: 60,
        bottomPad: 0,
      });
      this.notificationsCollection =
          new App.collections.NotificationCollection({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        title: 'Vehicle Events',
        parent: '.' + this.targetClass + ' div .dashboard-right .bottom',
        target: this.targetClass,
        height: 30,
        bottomPad: 0,
        singleVehicle: true,
      }).fetch();
      this.navigatorCollection =
          new App.collections.NavigatorCollection({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        timeRange: this.timeRange,
        title: 'Timeline',
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        target: this.targetClass,
        height: '40px',
        bottomPad: 0,
        singleVehicle: true,
      }).fetch();
      App.publish('VisibleTimeChange-' + this.tabId,
                  [this.timeRange.beg, this.timeRange.end]);
      return this;
    },

    hookGraphControls: function (graph, index) {
      _.extend(graph, Backbone.Events);
      graph.view.bind('channelRemoved',
          _.bind(this.checkChannelExistence, this));
      graph.view.bind('addGraph', _.bind(this.addGraph, this, index));
      graph.view.bind('removeGraph', _.bind(this.removeGraph, this, index));
      return this;
    },

    unhookGraphControls: function (g) {
      g.view.unbind('channelRemoved');
      g.view.unbind('addGraph');
      g.view.unbind('removeGraph');
      return this;
    },

    addGraph: function (index) {
      var viewRange = this.graphModels[0].view.getVisibleTime();
      var graphId = App.util.makeId();
      var graph = new App.models.GraphModel({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        timeRange: viewRange,
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        target: this.targetClass,
        height: 70,
        bottomPad: 0,
        id: graphId,
      });
      this.graphModels.push(graph);
      this.hookGraphControls(graph, this.graphModels.length - 1);
      this.arrangeGraphs();
      App.publish('GraphRequested-' + this.tabId, [graphId]);
      App.publish('WindowResize');
    },

    removeGraph: function (index) {
      var self = this;
      var graphId = self.graphModels[index].get('id');
      self.graphModels[index].destroy();
      self.graphModels.splice(index, 1);
      _.each(self.graphModels, function (g, i) {
        self.unhookGraphControls(g);
        self.hookGraphControls(g, i);
      });
      self.arrangeGraphs();
      App.publish('GraphUnrequested-' + this.tabId, [graphId]);
      App.publish('WindowResize');
    },

    arrangeGraphs: function () {
      var num = this.graphModels.length;
      var graphHeight = Math.floor(70 / num);
      var heightRem = 70 % num;
      var graphPad = Math.floor(63 / num);
      var padRem = 63 % num;
      _.each(this.graphModels, function (g, i) {
        g.view.options.height = graphHeight;
        g.view.options.bottomPad = graphPad;
        if (i === 0) {
          g.view.options.height += heightRem;
          g.view.options.bottomPad += padRem;
        }
      });
    },

    checkChannelExistence: function (channel) {
      if ($('[data-channel-name="'+channel.channelName+'"]', this.el).length <= 1) {
        this.treeModel.view.trigger('hideChannel', channel.channelName);
      }
    },

    destroy: function (clicked) {
      this._super('destroy', clicked);
      App.publish('VehicleUnrequested-' + this.tabId);
    },

  });
});









