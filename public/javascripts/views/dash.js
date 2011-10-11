/*!
 * Copyright 2011 Mission Motors
 */

define(['views/folderItem'], function (FolderItemView) {
  return FolderItemView.extend({
    initialize: function (args) {
      _.bindAll(this, 'render');
      return this;
    },

    render: function (opts, template) {
      this._super('render', opts, template);
      this.notificationCollection =
          new App.collections.NotificationCollection({
            parent: $('.dashboard-left', this.el)
          });
      this.notificationCollection.fetch();
      this.vehicleCollection =
          new App.collections.VehicleCollection({
            parent: $('.dashboard-right', this.el)
          });
      this.vehicleCollection.fetch();
      return this;
    },

  });
});









