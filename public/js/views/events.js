/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'mousedown .dashboard-item-header': 'adjustHeight',
      'click tr[data-title]': 'open',
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
      
      if (this.el.length)
        this.remove();
      var start = Date.now();
      this.el = App.engine('events.dash.jade', opts)
          .appendTo(this.options.parent);
      $('.event-info', this.el).each(function () {
        var b = $(this);
        b.html(b.text());
      });
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
      if (!parentRow) return;
      var timeRange = {
        beg: parseInt($('[data-time]', parentRow).attr('data-time')),
        end: parseInt($('[data-time-end]', parentRow).attr('data-time-end')),
      };
      var padding = 0.02 * (timeRange.end - timeRange.beg);
      var visibleRange = {
        beg: timeRange.beg - padding,
        end: timeRange.end + padding,
      };
      var props = this.getProps(parentRow);
      var channels = $('[data-channels]', parentRow).attr('data-channels');
      if (channels)
        channels = JSON.parse(channels);
      if (this.model.get('singleVehicle')) {
        App.publish('UnPreviewEvent-' + props.id);
        this.model.get('tabModel').set({ visibleTime: visibleRange });
        App.publish('PreviewEvent-' + props.id, [timeRange]);
        App.publish('OpenNote-' + props.id, [parentRow.attr('data-id')]);
      } else {
        var tabId = App.util.makeId();
        App.publish('VehicleRequested', [props.id, tabId, props.title,
                    visibleRange, false, function () {
          fetchChannels(channels, props.id, tabId, 'MASTER');
          _.delay(function () {
            App.publish('OpenNote-' + tabId, [null, timeRange]); 
          }, 1000);
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

    bounceArrow: function (row) {
      var self = this;
      var arrow = $('.arrow', row);
      if (arrow.length === 0) return;
      (function () {
        arrow.animate({
          left: '10px',
          easing: 'easeOutExpo',
        }, 200, function moveLeft() {
          arrow.css({ left: 0 });
        });
      })();
    },

    preview: function (e) {
      var parentRow = $(e.target).closest('tr');
      $('td', parentRow).each(function () {
        var _this = $(this);
        if (!_this.hasClass('row-arrow'))
          _this.css({'text-decoration': 'underline'});
      });
      this.bounceArrow(parentRow);
      if (!this.model.get('singleVehicle')) return;
      var beg = parseInt($('[data-time]', parentRow).attr('data-time'));
      var end = parseInt($('[data-time-end]', parentRow).attr('data-time-end'));
      var props = this.getProps(parentRow);
      App.publish('PreviewEvent-' + props.id, [{beg: beg, end: end}]);
      return this;
    },

    unpreview: function (e) {
      var parentRow = $(e.target).closest('tr');
      $('td', parentRow).each(function () {
        var _this = $(this);
        if (!_this.hasClass('row-arrow'))
          _this.css({'text-decoration': 'none'});
      });
      if (!this.model.get('singleVehicle')) return;
      var props = this.getProps(parentRow);
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

