/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'],
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'mouseenter tr': 'showPanel',
      'mouseleave tr': 'hidePanel',
      'click .open-vehicle': 'open',
      'click .config-link': 'configure',
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
      this.el = App.engine('vehicles.dash.jade', opts)
          .appendTo(this.options.parent);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      if (!opts.loading)
        App.publish('AppReady');
      return this;
    },

    showPanel: function (e) {
      var tr = $(e.target).closest('tr');
      $('.edit-panel', tr).css({ visibility: 'visible' });
    },

    hidePanel: function (e) {
      var tr = $(e.target).closest('tr');
      $('.edit-panel', tr).css({ visibility: 'hidden' });
    },

    open: function (e) {
      var attrs = this.getRowAttributesFromChild(e.target);
      var tabId = App.util.makeId();
      var timeRange = { beg: attrs.lastCycle.beg, end: attrs.lastCycle.end };
      App.publish('VehicleRequested',
          [attrs.id, tabId, attrs.title, timeRange]);
      return this;
    },

    configure: function (e) {
      var attrs = this.getRowAttributesFromChild(e.target);
      App.api.fetchVehicleConfig(attrs.id, function (err, xml) {
        if (err) throw err;
        else App.editorView.open('<span style="font-weight:normal;">Configure Vehicle:</span> ' +
            attrs.title + ' (' + attrs.id + ')', xml, function (data, cb) {
          App.api.saveVehicleConfig(attrs.id, data, cb);
        });
      });
    },

    getRowAttributesFromChild: function (child) {
      var tr = $(child).closest('tr');
      var items = tr.attr('id').split('_');
      var time = parseInt(
          $('[data-time]', tr).attr('data-time'));
      return {
        id: parseInt(items[items.length - 1]),
        title: tr.attr('data-title'),
        lastSeen: time,
        lastCycle: time === 0 ? null : JSON.parse(
            $('[data-cycle]', tr).attr('data-cycle')),
      };
    },

  });
});

