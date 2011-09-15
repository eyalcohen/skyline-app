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
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('graph.dash.jade', opts).appendTo(parent);
      this._super('render');
      if (!this.firstRender && !opts.loading && !opts.empty) {
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









