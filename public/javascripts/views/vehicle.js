/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'destroy', 'addGraph');
      App.subscribe('NotAuthenticated', this.destroy);
      // App.subscribe(args.parent + '-minimize-top', this.destroy);
      
      return this;
    },

    events: {
      // 'click .toggler': 'arrange',
    },

    render: function () {
      var self = this;
      self.el = App.engine('vehicle.jade').appendTo('.' + self.options.parent);
      self.items = {
        notifications: new App.collections.NotificationCollection({
          vehicleId: self.options.vehicleId,
          title: 'Notifications',
          parent: '.' + self.options.parent + ' div .dashboard-left',
          target: self.options.parent,
          height: 30,
          bottomPad: 0,
          single: true,
          // shrinkable: true,
        }),
        tree: new App.models.TreeModel({
          vehicleId: self.options.vehicleId,
          title: 'Available Channels',
          parent: '.' + self.options.parent + ' div .dashboard-left-side',
          target: self.options.parent,
          height: 70,
          bottomPad: 0,
        }),
        navigator: new App.collections.NavigatorCollection({
          vehicleId: self.options.vehicleId,
          title: 'Navigator',
          parent: '.' + self.options.parent + ' div .dashboard-right-wide .bottom',
          target: self.options.parent,
          height: '40px',
          bottomPad: 0,
          single: true,
        }),
        map: new App.models.MapModel({
          vehicleId: self.options.vehicleId,
          title: 'Map',
          parent: '.' + self.options.parent + ' div .dashboard-right',
          target: self.options.parent,
          height: 30,
          bottomPad: 0,
        }),
        graphs: [new App.models.GraphModel({
          vehicleId: self.options.vehicleId,
          title: 'Graph',
          parent: '.' + self.options.parent + ' div .dashboard-right-wide .top',
          target: self.options.parent,
          height: 70,
          bottomPad: 70,
          id: self.makeid(),
        })],
      };

      self.hookGraphControls(self.items.graphs[0], 0);
      self.items.notifications.fetch();
      self.items.tree.fetch();
      self.items.graphs[0].addChannel(_.clone(App.defaultChannel));
      self.items.navigator.fetch();

      return self;
    },

    hookGraphControls: function (g, i) {
      var self = this;
      _.extend(g, Backbone.Events);
      g.view.bind('addGraph', function () {
        self.addGraph(i);
      });
      g.view.bind('removeGraph', function () {
        self.removeGraph(i);
      });
      return self;
    },

    unhookGraphControls: function (g) {
      g.view.unbind('addGraph');
      g.view.unbind('removeGraph');
      return this;
    },

    addGraph: function (index) {
      var self = this;
      var graph = new App.models.GraphModel({
        vehicleId: self.options.vehicleId,
        title: 'Graph',
        parent: '.' + self.options.parent + ' div .dashboard-right-wide .top',
        target: self.options.parent,
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
      if (index === 0 && self.items.graphs.length === 1)
        return;
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

    arrange: function (state) {
      // if (state === 'close') {
      //   this.items.notifications.view.options.height = 0;
      //   this.items.map.view.options.height = 100;
      //   this.items.tree.view.options.height = 100;
      //   this.items.graph.view.options.height = 100;
      // } else {
      //   this.items.notifications.view.options.height = 20;
      //   this.items.tree.view.options.height = 80;
      //   this.items.map.view.options.height = 80;
      //   this.items.graph.view.options.height = 80;
      // }
      // App.publish('WindowResize');
    },

    destroy: function () {
      // TODO: use pubsub to kill all modules.
      this.remove();
      return this;
    },

    // TODO: move this somewhere that makes sense.
    makeid: function () {
      var text = '';
      var possible = 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      return text;
    }

  });
});









