/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'destroy');
      App.subscribe('NotAuthenticated', this.destroy);
      // App.subscribe(args.parent + '-minimize-top', this.destroy);
      return this;
    },

    events: {
      // 'click .toggler': 'arrange',
    },

    render: function (vehicleId, vehicleTitle) {
      var self = this;
      this.el = App.engine('vehicle.jade').appendTo('.' + this.options.parent);
      this.items = {
        notifications: new App.collections.NotificationCollection({
          vehicleId: vehicleId,
          title: 'Notifications',
          parent: '.' + this.options.parent + ' div .dashboard-left',
          target: this.options.parent,
          height: 30,
          bottomPad: 0,
          single: true,
          // shrinkable: true,
        }),
        tree: new App.models.TreeModel({
          vehicleId: vehicleId,
          title: 'Available Channels',
          parent: '.' + this.options.parent + ' div .dashboard-left-side',
          target: this.options.parent,
          height: 70,
          bottomPad: 0,
        }),
        navigator: new App.collections.NavigatorCollection({
          vehicleId: vehicleId,
          title: 'Navigator',
          parent: '.' + this.options.parent + ' div .dashboard-right-wide .bottom',
          target: this.options.parent,
          height: '40px',
          bottomPad: 0,
          single: true,
        }),
        map: new App.models.MapModel({
          vehicleId: vehicleId,
          title: 'Map',
          parent: '.' + this.options.parent + ' div .dashboard-right',
          target: this.options.parent,
          height: 30,
          bottomPad: 0,
        }),
        graph: new App.models.GraphModel({
          vehicleId: vehicleId,
          title: 'Graph',
          parent: '.' + this.options.parent + ' div .dashboard-right-wide .top',
          target: this.options.parent,
          height: 70,
          bottomPad: 70,
        }),
      };
      this.items.notifications.fetch();
      this.items.tree.fetch();
      this.items.navigator.fetch();
      // _.each(this.items, function (item) {
      //   if (item instanceof Backbone.Collection) {
      //     item.fetch();
      //     _.extend(item, Backbone.Events);
      //     item.view.bind('toggled', function (state) {
      //       self.arrange(state);
      //     });
      //   }
      //   // else if (item instanceof Backbone.Model)
      //   //   item.load.apply(this, opts);
      // });
      return this;
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
      this.remove();
      return this;
    },

  });
});









