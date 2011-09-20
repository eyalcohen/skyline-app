/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click [value="Open"]': 'open',
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
      this.el = App.engine('vehicles.dash.jade', opts).appendTo(App.regions.right);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    open: function (e) {
      e.preventDefault();
      var id = this.getId(e);
      var title = $(e.target).parent().parent().attr('data-title');
      App.publish('VehicleRequested', [id, title]);
      return this;
    },

  });
});

