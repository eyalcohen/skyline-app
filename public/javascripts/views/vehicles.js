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
        title: this.options.title,
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
      var lastSeen = parseInt(
          $('[data-time]', parentRow).attr('data-time'));
      var lastCycle = JSON.parse(
          $('[data-cycle]', parentRow).attr('data-cycle'));
      //var range = { beg: lastCycle.beg - 1e6*60*60*8,   // -8 hours
                    //end: lastCycle.end + 1e6*60*60*2 }; // +2 hours
      var items = parentRow.attr('id').split('_');
      var id = parseInt(items[items.length - 1]);
      var title = $(e.target).closest('tr').attr('data-title');
      App.publish('VehicleRequested', [id, title, lastCycle]);
      return this;
    },

  });
});

