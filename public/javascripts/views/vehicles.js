/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click .open-vehicle': 'open',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        rows: this.collection.models,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('vehicles.dash.jade', opts)
          .appendTo(this.options.parent);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    open: function (e) {
      var parentRow = $(e.target).closest('tr');
      var lastSeen = parseInt($('[data-time]', parentRow)
          .attr('data-time')) / 1e3;
      var range = { min: lastSeen - 60*60*24*7*26*1000, // one year
            max: lastSeen + 60*60*24*7*26*1000, snap: false };
      var items = parentRow.attr('id').split('_');
      var id = parseInt(items[items.length - 1]);
      var title = $(e.target).closest('tr').attr('data-title');
      App.publish('VehicleRequested', [id, title, range]);
      return this;
    },

  });
});

