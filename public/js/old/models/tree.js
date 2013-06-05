/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      // Store fetched data in object variable rather than backbone attributes
      // to avoid backbone overhead.
      this.data = []
      this.channelMap = {};

      this.tabModel = args.tabModel;
      this.view = new App.views.TreeView(args);
      _.bindAll(this, 'destroy', 'visibleTimeChanged', 'updateCheckedChannels',
                'fetchChannelInfo');
      var tabId = args.tabId, vehicleId = args.vehicleId;
      App.subscribe('VehicleUnrequested-' + tabId, this.destroy);
      this.visibleTimeChangedDebounced =
          _.debounce(this.visibleTimeChanged, 50);
      this.tabModel.bind('change:visibleTime',
                         this.visibleTimeChangedDebounced);
      this.updateCheckedChannelsDebounced =
          _.debounce(this.updateCheckedChannels, 50);
      App.subscribe('GraphedChannelsChanged-' + tabId,
                    this.updateCheckedChannelsDebounced);
      // This is a horribly crufty way to allow fetching the channel tree by
      // other models...  Perhaps instead we should subscribe to _schema, and
      // build the channel tree client-side?
      App.subscribe('FetchChannelInfo-' + vehicleId, this.fetchChannelInfo);
      return this;
    },

    destroy: function () {
      var tabId = this.get('tabId'), vehicleId = this.get('vehicleId');
      App.unsubscribe('VehicleUnrequested-' + tabId, this.destroy);
      this.tabModel.unbind('change:visibleTime',
                           this.visibleTimeChangedDebounced);
      App.unsubscribe('GraphedChannelsChanged-' + tabId,
                    this.updateCheckedChannelsDebounced);
      App.unsubscribe('FetchChannelInfo-' + vehicleId, this.fetchChannelInfo);
    },

    fetch: function (showLoading, callback) {
      var self = this;
      self.view.render({ loading: showLoading == null ? true : showLoading });
      App.api.fetchChannelTree(self.get('vehicleId'), function (err, data) {
        if (err) { throw err; return; }
        if (!data || data.length === 0) {
          console.warn('Vehicle with id ' + self.get('vehicleId') +
              ' has never been seen before!');
        } else {
          self.data = data;
          self.channelMap = {}; // Map from channel name to schema.
          (self.data || []).forEach(function traverseDesc(desc) {
            if (desc.channelName)
              self.channelMap[desc.channelName] = desc;
            else
              (desc.sub || []).forEach(traverseDesc);
          });
          self.view.render();
        }
        if (callback) callback();
      });
      return self;
    },

    visibleTimeChanged: function (model, visibleTime) {
      this.view.visibleTimeChanged(visibleTime);
    },

    updateCheckedChannels: function () {
      this.view.updateCheckedChannels();
    },

    findChannelInfo: function(channelName) {
      return this.channelMap[channelName];
    },

    fetchChannelInfo: function(chan, cb) {
      cb(this.findChannelInfo(chan));
    },

  });
});

