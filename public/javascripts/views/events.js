/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'mousedown .dashboard-item-header': 'adjustHeight',
      'click .open-vehicle': 'open',
      'mouseenter tr[data-title]': 'preview',
      'mouseleave tr[data-title]': 'unpreview',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        loading: false,
        singleVehicle: this.model.get('singleVehicle'),
        shrinkable: this.options.shrinkable,
        shrunk: this.options.weight === 0,
        rows: this.model.get('events'),
      });
      
      if (this.el.length) {
        this.remove();
      }
      var start = Date.now();
      this.el = App.engine('events.dash.jade', opts)
          .appendTo(this.options.parent);
      // console.log('events.dash.jade took', Date.now() - start);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      this.setDuration();
      if (!opts.loading)
        App.publish('AppReady');
      return this;
    },

    open: function (e) {
      var parentRow = $(e.target).closest('tr');
      var timeRange = {
        beg: parseInt($('[data-time]', parentRow).attr('data-time')),
        end: parseInt($('[data-time-end]', parentRow).attr('data-time-end')),
      };
      var props = this.getProps(parentRow);
      var channels = $('[data-channels]', parentRow).attr('data-channels');
      if (channels)
        channels = JSON.parse(channels);
      if (this.model.get('singleVehicle')) {
        App.publish('UnPreviewEvent-' + props.id);
        this.model.get('tabModel').set({ visibleTime: timeRange });
        App.publish('PreviewEvent-' + props.id, [timeRange]);
        if (channels) {
          var graphId = App.util.makeId();
          var tabId = this.model.get('tabId');
          App.publish('GraphRequested-' + tabId, [graphId]);
          fetchChannels(channels, this.model.get('vehicleId'), tabId, graphId);
        }
      } else {
        var tabId = App.util.makeId();
        App.publish('VehicleRequested', [props.id, tabId, props.title,
                    timeRange, false, function () {
          fetchChannels(channels, props.id, tabId, 'MASTER');
        }]);
      }

      function fetchChannels(chans, vId, tId, gId) {
        if (!chans || chans.length === 0) return;
        _.each(chans, function (channelName, i) {
          App.publish('FetchChannelInfo-' + vId,
                      [channelName, function (channel) {
            if (!channel) return;
            channel.yaxisNum = (i % 2) + 1;
            channel.title = channel.humanName || channel.shortName;
            if (channel.units)
              channel.title += ' (' + channel.units + ')';
            App.publish('ChannelRequested-' + tId + '-' + gId, [channel]);
          }]);
        });
      }

      return this;
    },

    preview: function (e) {
      if (!this.model.get('singleVehicle')) return;
      var parentRow = $(e.target).closest('tr');
      var beg = parseInt($('[data-time]', parentRow).attr('data-time'));
      var end = parseInt($('[data-time-end]', parentRow).attr('data-time-end'));
      var props = this.getProps(parentRow);
      App.publish('PreviewEvent-' + props.id, [{beg: beg, end: end}]);
      return this;
    },

    unpreview: function (e) {
      if (!this.model.get('singleVehicle')) return;
      var props = this.getProps($(e.target).closest('tr'));
      App.publish('UnPreviewEvent-' + props.id);
      return this;
    },

    getProps: function (ctx) {
      var id, title;
      if (ctx.attr('id')) {
        var items = ctx.attr('id').split('_');
        id = parseInt(items[items.length - 1]);
        title = ctx.attr('data-title');
      } else {
        id = this.options.tabId;
        title = null;
      }
      return { id: id, title: title };
    },

  });
});

