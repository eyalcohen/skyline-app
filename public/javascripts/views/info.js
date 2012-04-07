/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {},

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: this.options.shrinkable,
      });
      if (this.el.length)
        this.remove();
      this.el = App.engine('info.dash.jade', opts).appendTo(this.options.parent);
      this._super('render');
      return this;
    },



  });
});
