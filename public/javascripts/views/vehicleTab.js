/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      App.subscribe('KillallTabs', this.destroy);
      return this;
    },

    destroy: function (clicked) {
      this._super('destroy', clicked);
      App.unsubscribe('KillallTabs', this.destroy);
      App.publish('VehicleUnrequested-' + this.model.tabId);
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      return this;
    },

    arrangeGraphs: function (total, delta, resize) {
      if (total === 0) return;
      if (delta === 0) return;
      var graphModels = this.model.graphModels;
      var num = graphModels.length;
      if (delta) {
        var graphHeightSub = Math.floor(delta / num);
        var heightRemSub = delta - (num * graphHeightSub);
        _.each(graphModels, function (g, i) {
          g.view.options.height -= graphHeightSub;
          if (i === 0)
            g.view.options.height -= heightRemSub;
          if (resize)
            g.view.resize();
        });
      } else {
        total -= 1;
        total -= 20;
        var graphHeight = Math.floor(total / num);
        var heightRem = total - (num * graphHeight);
        _.each(graphModels, function (g, i) {
          g.view.options.height = graphHeight;
          if (i === 0)
            g.view.options.height += heightRem + 20;
          if (resize)
            g.view.resize();
        });
      }
    },

  });
});

