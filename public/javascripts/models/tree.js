/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.TreeView(args);
      this.view.render({ loading: true });
      _.bindAll(this, 'load');
      // App.subscribe('VehicleRequested', this.load);
      return this;
    },

    load: function (vehicleId) {
      var self = this;
      App.api.fetchChannelTree(vehicleId, function (err, data) {
        if (err) {
          throw err;
          return;
        }
        if (!data || data.length === 0) {
          console.warn('Vehicle with id ' + vehicleId + ' has no'+
              ' data for the time range requested.');
        } else {
          self.set({
            data: data
          });
          self.view.render();
        }
      });
      return this;
    },

  });
});

