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
      var tabId = this.options.tabId;
      App.unsubscribe('KillallTabs', this.destroy);
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      return this;
    },

    arrangeGraphs: function () {
      var graphModels = this.model.graphModels;
      var num = graphModels.length;
      var graphHeight = Math.floor(70 / num);
      var heightRem = 70 % num;
      var graphPad = Math.floor(63 / num);
      var padRem = 63 % num;
      _.each(graphModels, function (g, i) {
        g.view.options.height = graphHeight;
        g.view.options.bottomPad = graphPad;
        if (i === 0) {
          g.view.options.height += heightRem;
          g.view.options.bottomPad += padRem;
        }
      });
    },

  });
});

