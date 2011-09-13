/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem'], 
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
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('tree.dash.jade', opts).appendTo(parent);
      this.setup();
      this.delegateEvents();
      if (this.firstRender) {
        this.firstRender = false;
        this.el.fadeIn('fast');
      } else {
        this.content.hide();
        this.el.show();
        this.content.show('fast');
        if (!opts.loading && !opts.empty)
          this.draw();
      }
      return this;
    },

    draw: function () {
      
      return this;
    },

  });
});









