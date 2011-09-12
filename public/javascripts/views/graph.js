/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        empty: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('graph.dash.jade', opts).appendTo(App.regions.right);
      this.setup();
      this.delegateEvents();
      if (this.firstRender) {
        this.firstRender = false;
        this.el.fadeIn('fast');
      } else {
        this.content.hide();
        this.el.show();
        this.content.show('fast');
        this.draw();
      }
      return this;
    },

    draw: function () {
      $.plot($('.graph', this.content),
          [this.model.attributes.data], {
        xaxis: {
          mode: 'time'
          // min: (new Date(1990, 1, 1)).getTime(),
          // max: (new Date(2000, 1, 1)).getTime(),
        },
      });

      return this;
    },

  });
});









