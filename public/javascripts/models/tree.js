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
      // This is a horribly crufty way to allow fetching the channel tree by
      // other models...  Perhaps instead we should subscribe to _schema, and
      // build the channel tree client-side?
      App.subscribe('FetchChannelInfo-' + args.vehicleId,
                    _.bind(this.fetchChannelInfo, this));
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

    fetchChannelInfo: function(channel, cb) {
      var result = null;
      function f(desc) {
        if (desc.channelName === channel)
          result = desc;
        else
          (desc.sub || []).forEach(f);
      };
      (this.attributes.data || []).forEach(f);
      cb(result);
    },

  });
});

