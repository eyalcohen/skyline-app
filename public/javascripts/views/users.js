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
        rows: this.collection.models,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('users.dash.jade', opts)
          .appendTo($('.preferences .dashboard-top'));
      this._super('render');
      return this;
    },

    load: function (e) {
      // 
      return this;
    },

  });
});

