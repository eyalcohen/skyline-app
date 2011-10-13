/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      _.bindAll(this, 'addGraph');
      return this;
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      this.vehicleId = opts.vehicleId;
      this.targetClass = opts.targetClass;
      this.timeRange = opts.timeRange;
      this.treeModel = new App.models.TreeModel({
        vehicleId: this.vehicleId,
        title: 'Available Channels',
        parent: '.' + this.targetClass + ' div .dashboard-left .top',
        target: this.targetClass,
        height: 40,
        bottomPad: 0,
      }).fetch();
      this.graphModels = [new App.models.GraphModel({
        vehicleId: this.vehicleId,
        timeRange: this.timeRange,
        title: 'Graphs',
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        target: this.targetClass,
        height: 70,
        bottomPad: 103,
        id: this.makeid(),
      }).addChannel(_.clone(App.defaultChannel))];
      this.hookGraphControls(this.graphModels[0], 0);
      this.mapModel = new App.models.MapModel({
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
        vehicleId: this.vehicleId,
        timeRange: this.timeRange,
        title: 'Timeline',
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        target: this.targetClass,
        height: '80px',
        bottomPad: 0,
        singleVehicle: true,
      }).fetch();
      return this;
    },

    hookGraphControls: function (graph, index) {
      var self = this;
      _.extend(graph, Backbone.Events);
      graph.view.bind('channelRemoved',
          _.bind(self.checkChannelExistence, self));
      graph.view.bind('addGraph', function () {
        self.addGraph(index);
      });
      graph.view.bind('removeGraph', function () {
        self.removeGraph(index);
      });
      return self;
    },

    unhookGraphControls: function (g) {
      g.view.unbind('channelRemoved');
      g.view.unbind('addGraph');
      g.view.unbind('removeGraph');
      return this;
    },

    addGraph: function (index) {
      var self = this;
      var viewRange = self.graphModels[0].view.getVisibleTime();
      viewRange.min = viewRange.beg / 1e3;
      viewRange.max = viewRange.end / 1e3;
      var graph = new App.models.GraphModel({
        vehicleId: self.vehicleId,
        timeRange: viewRange,
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        target: this.targetClass,
        height: 70,
        bottomPad: 70,
        id: self.makeid(),
      });
      self.graphModels.push(graph);
      var num = self.graphModels.length;
      self.hookGraphControls(graph, num - 1);
      _.each(self.graphModels, function (g, i) {
        g.view.options.height = 70 / num;
        g.view.options.bottomPad = 70 / num + ((num-1) * 7);
      });
      App.publish('WindowResize');
      graph.addChannel(App.defaultChannel);
    },

    removeGraph: function (index) {
      var self = this;
      // TODO: visually deactivate the (-) button when we
      // don't want the graph removed.
      if (index === 0 && self.graphModels.length === 1) return;
      self.graphModels[index].destroy();
      self.graphModels.splice(index, 1);
      var num = self.graphModels.length;
      _.each(self.graphModels, function (g, i) {
        self.unhookGraphControls(g);
        self.hookGraphControls(g, i);
        g.view.options.height = 70 / num;
        g.view.options.bottomPad = 70 / num + ((num-1) * 7);
      });
      App.publish('WindowResize');
    },

    checkChannelExistence: function (channel) {
      if ($('[data-channel-name="'+channel.channelName+'"]').length === 0) {
        this.treeModel.view.trigger('hideChannel', channel.channelName);
      }
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









