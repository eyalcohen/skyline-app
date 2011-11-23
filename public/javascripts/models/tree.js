/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      var self = this;
      if (!args) args = {};
      _.extend(args, { model: self });
      self.view = new App.views.TreeView(args);
      _.bindAll(self, 'destroy', 'changeVisibleTime', 'updateCheckedChannels',
                'fetchChannelInfo');
      var tabId = args.tabId, vehicleId = args.vehicleId;
      App.subscribe('VehicleUnrequested-' + tabId, self.destroy);
      App.subscribe('VisibleTimeChange-' + tabId, self.changeVisibleTime);
      self.updateCheckedChannelsDebounced =
          _.debounce(self.updateCheckedChannels, 50);
      App.subscribe('GraphedChannelsChanged-' + tabId,
                    self.updateCheckedChannelsDebounced);
      // This is a horribly crufty way to allow fetching the channel tree by
      // other models...  Perhaps instead we should subscribe to _schema, and
      // build the channel tree client-side?
      App.subscribe('FetchChannelInfo-' + vehicleId, self.fetchChannelInfo);
      return self;
    },

    destroy: function () {
      var tabId = this.get('tabId'), vehicleId = this.get('vehicleId');
      App.unsubscribe('VehicleUnrequested-' + tabId, this.destroy);
      App.unsubscribe('VisibleTimeChange-' + tabId, this.changeVisibleTime);
      App.unsubscribe('GraphedChannelsChanged-' + tabId,
                    this.updateCheckedChannelsDebounced);
      App.unsubscribe('FetchChannelInfo-' + vehicleId, this.fetchChannelInfo);
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

    changeVisibleTime: function (beg, end) {
      this.view.changeVisibleTime(beg, end);
    },

    updateCheckedChannels: function () {
      this.view.updateCheckedChannels();
    },

    findChannelInfo: function(channel) {
      var result = null;
      function f(desc) {
        if (desc.channelName === channel)
          result = desc;
        else
          (desc.sub || []).forEach(f);
      };
      (this.get('data') || []).forEach(f);
      return result;
    },

    fetchChannelInfo: function(chan, cb) {
      cb(this.findChannelInfo(chan));
    },

  });
});

