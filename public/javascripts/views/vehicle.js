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

    render: function (opts) {
      var self = this;
      this.el = App.engine('vehicle.jade').appendTo('.' + this.options.parent);
      this.items = {
        notifications: new App.collections.NotificationCollection({
          title: 'Notifications',
          parent: '.' + this.options.parent + ' div .dashboard-top',
          target: this.options.parent,
          height: 20,
          shrinkable: true,
        }),
        tree: new App.models.TreeModel({
          title: 'Available Channels',
          parent: '.' + this.options.parent + ' div .dashboard-right-side',
          target: this.options.parent,
          height: 80,
        }),
        map: new App.models.MapModel({
          title: 'Map',
          parent: '.' + this.options.parent + ' div .dashboard-left-side',
          target: this.options.parent,
          height: 80,
        }),
        graph: new App.models.GraphModel({
          title: 'Graph',
          parent: '.' + this.options.parent + ' div .dashboard-middle',
          target: this.options.parent,
          height: 80,
        }),
      };
      _.each(this.items, function (item) {
        if (item instanceof Backbone.Collection) {
          item.fetch();
          _.extend(item, Backbone.Events);
          item.view.bind('toggled', function (state) {
            self.arrange(state);
          });
        }
        else if (item instanceof Backbone.Model)
          item.load.apply(this, opts);
      });
      return this;
    },

    arrange: function (state) {
      if (state === 'close') {
        this.items.notifications.view.options.height = 0;
        this.items.tree.view.options.height = 100;
        this.items.map.view.options.height = 100;
        this.items.graph.view.options.height = 100;
      } else {
        this.items.notifications.view.options.height = 20;
        this.items.tree.view.options.height = 80;
        this.items.map.view.options.height = 80;
        this.items.graph.view.options.height = 80;
      }
      App.publish('WindowResize');
    },

    destroy: function () {
      this.remove();
      return this;
    },

  });
});









