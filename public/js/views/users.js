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
        title: this.options.title,
        loading: false,
        rows: this.collection.models,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('users.dash.jade', opts)
          .appendTo($('.preferences .dashboard-left'));
      this._super('render');
      return this;
    },

    load: function (e) {
      // 
      return this;
    },

  });
});

