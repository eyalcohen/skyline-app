/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        shrinkable: this.options.shrinkable,
        rows: this.collection.models,
      });
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('notifications.dash.jade', opts).appendTo(parent);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    load: function (e) {
      e.preventDefault();
      return this;
    },

  });
});

