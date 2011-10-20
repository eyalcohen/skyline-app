/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.view = new App.views.TreeView(args);
      _.bindAll(this, 'destroy', 'fetchChannelInfo');
      this.view.bind('hideChannel', _.bind(this.view.hideChannel, this.view));
      App.subscribe('HideVehicle-' + args.tabId, this.destroy);
      // This is a horribly crufty way to allow fetching the channel tree by
      // other models...  Perhaps instead we should subscribe to _schema, and
      // build the channel tree client-side?
      App.subscribe('FetchChannelInfo-' + args.vehicleId, this.fetchChannelInfo);
      return this;
    },

    destroy: function () {
      App.unsubscribe('HideVehicle-' + this.get('tabId'), this.destroy);
      App.unsubscribe('FetchChannelInfo-' + this.get('vehicleId'),
          this.fetchChannelInfo);
    },

    fetch: function () {
      var self = this;
      self.view.render({ loading: true });
      App.api.fetchChannelTree(self.get('vehicleId'), function (err, data) {
        if (err) { throw err; return; }
        if (!data || data.length === 0) {
          console.warn('Vehicle with id ' + self.get('vehicleId') +
              ' has never been seen before!');
        } else {
          self.set({ data: data });
          self.view.render();
        }
      });
      return this;
    },

    fetchChannelInfo: function(channel, cb) {
      var result = null;
      function f(desc) {
        if (desc.channelName === channel)
          result = desc;
        else
          (desc.sub || []).forEach(f);
      };
      (this.get('data') || []).forEach(f);
      cb(result);
    },

  });
});

