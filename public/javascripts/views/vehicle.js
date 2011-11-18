/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      _.bindAll(this, 'addGraph', 'removeGraph', 'bindGraph', 'unbindGraph',
          'checkChannelExistence', 'requestDefaultChannel');
      App.subscribe('KillallTabs', this.destroy);
      return this;
    },

    destroy: function (clicked) {
      this._super('destroy', clicked);
      App.unsubscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.unsubscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      App.publish('VehicleUnrequested-' + this.tabId);
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
      this.treeModel.view.bind('ready', this.requestDefaultChannel);
      this.graphModels = [];
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
      App.subscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.subscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      if (!App.stateMonitor.isRestoring)
        this.addGraph('MASTER');
      App.publish('VisibleTimeChange-' + this.tabId,
                  [this.timeRange.beg, this.timeRange.end]);
      return this;
    },

    bindGraph: function (graph) {
      _.extend(graph, Backbone.Events);
      graph.view.bind('channelRemoved', this.checkChannelExistence);
      graph.bind('channelAdded', _.bind(function (channelName) {
        this.treeModel.view.showChannel(channelName, true);
      }, this));
    },

    unbindGraph: function (graph) {
      graph.view.unbind('channelRemoved', this.checkChannelExistence);
    },

    addGraph: function (id) {
      var timeRange = this.graphModels.length === 0 ?
          this.timeRange :
          this.graphModels[0].view.getVisibleTime();
      var isMaster = id == 'MASTER';
      var graph = new App.models.GraphModel({
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        timeRange: timeRange,
        title: isMaster ? 'Graphs' : null,
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        target: this.targetClass,
        height: 70,
        bottomPad: isMaster ? 63 : 0,
        id: id,
      });
      this.bindGraph(graph);
      this.graphModels.push(graph);
      this.arrangeGraphs();
      App.publish('WindowResize');
    },

    removeGraph: function (id) {
      var graph = _.find(this.graphModels, function (g) {
        return g.get('id') == id;
      });
      graph.destroy();      
      this.graphModels = _.reject(this.graphModels, function (g) {
        return g.get('id') == id;
      });
      this.unbindGraph(graph);
      this.arrangeGraphs();
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

    requestDefaultChannel: function (channel) {
      var master = _.find(this.graphModels, function (graph) {
        return graph.id == 'MASTER';
      });
      if (master.get('channels').length === 0)
        App.publish('ChannelRequested-' +
            this.tabId + '-MASTER', [channel]);
    },

  });
});

