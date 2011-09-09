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
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('map.dash.jade', opts).appendTo(App.regions.left);
      this.setup();
      this.delegateEvents();
      if (this.firstRender) {
        this.firstRender = false;
        this.el.fadeIn('fast');
      } else {
        this.content.hide();
        this.el.show();
        this.content.show('fast');
      }

      return this;
    },

    parse: function () {
      
    },

  });
});

