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
      // 'mousedown .resize-horizontal': 'arrange', // why does this not work??
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

      self.hookResizers();

      return self;
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

    hookResizers: function () {
      $('.resize-horizontal', this.el).bind('mousedown',
          _.bind(_.debounce(this.arrangeHorizontal, 100), this));
      $('.resize-vertical', this.el).bind('mousedown',
          _.bind(_.debounce(this.arrangeVertical, 100), this));
      App.subscribe('WindowResize', _.bind(function () {
        var targets = $('.resize-horizontal', this.el);
        targets.each(function (i) {
          var target = $(targets[i]);
          var ref = $(target.siblings().get(0));
          console.log(parseInt(ref.offset().top));
          target.css({ top: (ref.height() / 2 - target.height() / 2) +
              parseInt(ref.offset().top) });
        });
      }), this);
    },

    arrangeHorizontal: function (e) {
      var target = $(e.target);
      var left = $(target.siblings().get(0));
      var right = $(target.siblings().get(1));
      var left_w_orig = left.width();
      var right_w_orig = right.width();
      var mouse_orig = { x: e.pageX, y: e.pageY };
      var movehandle = function (e) {
        var m = { x: e.pageX, y: e.pageY };
        var lw = left_w_orig + (m.x - mouse_orig.x);
        var rw = right_w_orig - (m.x - mouse_orig.x);
        if (lw < 200 || rw < 200) return false;
        left.width(lw);
        right.width(rw);
      };
      $(document).bind('mousemove', movehandle);
      $(document).bind('mouseup', function (e) {
        $(this).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
      App.publish('WindowResize');
    },

    arrangeVertical: function (e) {
      
    },

    destroy: function () {
      // TODO: use pubsub to kill all modules.
      this.remove();
      return this;
    },

    // TODO: move this somewhere that makes sense.
    // TODO: use a global counter or something, rather than assuming random
    // numbers won't collide.
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









