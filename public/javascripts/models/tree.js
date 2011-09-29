/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.TreeView(args);
      this.view.bind('hideChannel', _.bind(this.view.hideChannel, this.view));
      return this;
    },

    fetch: function () {
      var self = this;
      self.view.render({ loading: true });
      App.api.fetchChannelTree(self.attributes.vehicleId,
          function (err, data) {
        if (err) { throw err; return; }
        if (!data || data.length === 0) {
          console.warn('Vehicle with id ' + self.attributes.vehicleId +
              ' has never been seen before!');
        } else {
          self.set({
            data: data,
          });
          self.view.render();
        }
      });
      return this;
    },

  });
});

