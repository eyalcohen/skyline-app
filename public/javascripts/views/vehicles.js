/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem'], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click [title="explore"]': 'load',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        rows: this.collection.models,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('vehicles.dash.jade', opts).appendTo(App.regions.top);
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
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    load: function (e) {
      e.preventDefault();
      this.minimize();
      var id = this.getId(e);
      App.publish('VehicleRequested', [id]);
      return this;
    },

  });
});

