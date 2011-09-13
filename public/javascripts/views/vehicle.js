/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'destroy');
      App.subscribe('NotAuthenticated', this.destroy);
      App.subscribe('Close-' + args.className, this.destroy);
      return this;
    },

    events: {
      // 'click .toggler': 'toggle',
    },

    render: function (opts) {
      this.el = App.engine('vehicle.jade').appendTo('.'+this.options.parent);
      this.items = {
        notifications: new App.collections.NotificationCollection({
            parent: '.' + this.options.parent + ' div .dashboard-top',
        }),
        tree: new App.models.TreeModel({
          parent: '.' + this.options.parent + ' div .dashboard-right',
        }),
        map: new App.models.MapModel({
          parent: '.' + this.options.parent + ' div .dashboard-left',
        }),
        graph: new App.models.GraphModel({
          parent: '.' + this.options.parent + ' div .dashboard-right',
        }),
      };
      _.each(this.items, function (item) {
        if (item instanceof Backbone.Collection)
          item.fetch();
        else if (item instanceof Backbone.Model)
          item.load.apply(this, opts);
      });
      return this;
    },

    destroy: function () {
      this.remove();
      return this;
    },

  });
});









