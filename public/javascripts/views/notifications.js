/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click .open-vehicle': 'open',
      'mouseenter tr[data-title]': 'preview',
      'mouseleave tr[data-title]': 'unpreview',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        loading: false,
        singleVehicle: false,
        shrinkable: this.options.shrinkable,
        rows: this.collection.models,
      });
      this.singleVehicle = opts.singleVehicle;
      if (this.el.length) {
        this.remove();
      }
      var start = Date.now();
      this.el = App.engine('notifications.dash.jade', opts)
          .appendTo(this.options.parent);
      // console.log('notifications.dash.jade took', Date.now() - start);
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
      if (this.singleVehicle) {
        App.publish('UnPreviewNotification-' + props.id);
        this.collection.tabModel.set({ visibleTime: timeRange });
        App.publish('PreviewNotification-' + props.id, [timeRange]);
      } else {
        var tabId = App.util.makeId();
        App.publish('VehicleRequested', [props.id, tabId, props.title, timeRange]);
      }
      return this;
    },

    preview: function (e) {
      if (!this.singleVehicle) return;
      var parentRow = $(e.target).closest('tr');
      var beg = parseInt($('[data-time]', parentRow).attr('data-time'));
      var end = parseInt($('[data-time-end]', parentRow).attr('data-time-end'));
      var props = this.getProps(parentRow);
      App.publish('PreviewNotification-' + props.id, [{beg: beg, end: end}]);
      return this;
    },

    unpreview: function (e) {
      if (!this.singleVehicle) return;
      var props = this.getProps($(e.target).closest('tr'));
      App.publish('UnPreviewNotification-' + props.id);
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

