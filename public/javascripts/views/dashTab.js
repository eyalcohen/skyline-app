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
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      return this;
    },

  });
});









