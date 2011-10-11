/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'addGraph');
      return this;
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      this.vehicleId = opts.vehicleId;
      this.targetClass = opts.targetClass;
      this.treeModel = new App.models.TreeModel({
        vehicleId: this.vehicleId,
        title: 'Available Channels',
        parent: '.' + this.targetClass + ' div .dashboard-left .bottom',
        target: this.targetClass,
        height: 60,
        bottomPad: 0,
      }).fetch();
      this.graphModels = [new App.models.GraphModel({
        vehicleId: this.vehicleId,
        title: 'Graph',
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        target: this.targetClass,
        height: 60,
        bottomPad: 103,
        id: this.makeid(),
      }).addChannel(_.clone(App.defaultChannel))];
      // this.hookGraphControls(this.graphModels[0], 0);
      this.mapModel = new App.models.MapModel({
        vehicleId: this.vehicleId,
        title: 'Map',
        parent: '.' + this.targetClass + ' div .dashboard-left .top',
        target: this.targetClass,
        height: 40,
        bottomPad: 0,
      });
      this.notificationsCollection =
          new App.collections.NotificationCollection({
        vehicleId: this.vehicleId,
        title: 'Notifications',
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        target: this.targetClass,
        height: 40,
        bottomPad: 0,
        single: true,
      }).fetch();
      this.navigatorCollection =
          new App.collections.NavigatorCollection({
        vehicleId: this.vehicleId,
        title: 'Navigator',
        parent: '.' + this.targetClass + ' div .dashboard-right .bottom',
        target: this.targetClass,
        height: '80px',
        bottomPad: 0,
        single: true,
      }).fetch();
      return this;
    },

    hookGraphControls: function (g, i) {
      var self = this;
      _.extend(g, Backbone.Events);
      g.view.bind('channelRemoved', _.bind(self.checkChannelExistence, self));
      g.view.bind('addGraph', function () {
        self.addGraph(i);
      });
      g.view.bind('removeGraph', function () {
        self.removeGraph(i);
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
      var graph = new App.models.GraphModel({
        vehicleId: self.options.vehicleId,
        title: 'Graph',
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        target: this.targetClass,
        height: 70,
        bottomPad: 70,
        id: self.makeid(),
      });
      self.items.graphs.push(graph);
      var num = self.items.graphs.length;
      self.hookGraphControls(graph, num - 1);
      _.each(self.items.graphs, function (g, i) {
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
      if (index === 0 && self.items.graphs.length === 1) return;
      self.items.graphs[index].destroy();
      self.items.graphs.splice(index, 1);
      var num = self.items.graphs.length;
      _.each(self.items.graphs, function (g, i) {
        self.unhookGraphControls(g);
        self.hookGraphControls(g, i);
        g.view.options.height = 70 / num;
        g.view.options.bottomPad = 70 / num + ((num-1) * 7);
      });
      App.publish('WindowResize');
    },

    checkChannelExistence: function (channel) {
      if ($('[data-channel-name="'+channel.channelName+'"]').length === 0) {
        this.items.tree.view.trigger('hideChannel', channel.channelName);
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









