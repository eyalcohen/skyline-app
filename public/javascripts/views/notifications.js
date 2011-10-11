/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        single: false,
        shrinkable: this.options.shrinkable,
        rows: this.collection.models,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('notifications.dash.jade', opts)
          .appendTo(this.options.parent);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      this.setDuration();
      return this;
    },

  });
});

