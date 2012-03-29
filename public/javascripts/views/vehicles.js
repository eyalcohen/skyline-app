/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem'],
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'mouseenter tr': 'enterRow',
      'mouseleave tr': 'leaveRow',
      'click tr[data-title]': 'open',
      'click .config-link': 'configure',
    },

    render: function (opts) {
      opts = opts || {};
      if (DEMO && !this.collection.models[0].attributes.title) {
        _.each(this.collection.models, function (m) {
          var end = Math.round((Date.now() - (Math.random() * 60*60*24*1000)) * 1000);
          m.attributes.lastCycle = {
            beg: end - Math.random() * 60*10*1000*1000,
            end: end,
          };
        });
        this.collection.models.sort(function (a, b) {
          return b.attributes.lastCycle.end - a.attributes.lastCycle.end;
        });
      }
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

    enterRow: function (e) {
      var tr = $(e.target).closest('tr');
      var attrs = this.getRowAttributesFromChild(tr);
      $('.edit-panel', tr).css({ visibility: 'visible' });
      if (attrs && attrs.lastCycle && attrs.lastCycle.beg !== 0) { 
        $('td', tr).each(function () {
          var _this = $(this);
          if (!_this.hasClass('row-arrow')) {
            if (_this.children().length > 0)
              $(this.firstElementChild).css({'text-decoration': 'underline'});
            else
              _this.css({'text-decoration': 'underline'});
          }
        });
        this.bounceArrow(tr);
      }
    },

    leaveRow: function (e) {
      var tr = $(e.target).closest('tr');
      var attrs = this.getRowAttributesFromChild(tr);
      $('.edit-panel', tr).css({ visibility: 'hidden' });
      if (attrs && attrs.lastCycle && attrs.lastCycle.beg !== 0) {
        $('td', tr).each(function () {
          var _this = $(this);
          if (!_this.hasClass('row-arrow')) {
            if (_this.children().length > 0)
              $(this.firstElementChild).css({'text-decoration': 'none'});
            else
              _this.css({'text-decoration': 'none'});
          }
        });
      }
    },

    bounceArrow: function (row) {
      var self = this;
      var arrow = $('.arrow', row);
      if (arrow.length === 0) return;
      (function () {
        arrow.animate({
          left: '10px',
          easing: 'easeOutExpo',
        }, 200, function moveLeft() {
          arrow.css({ left: 0 });
        });
      })();
    },

    open: function (e) {
      if ($(e.target).hasClass('config-link')) return;
      var attrs = this.getRowAttributesFromChild(e.target);
      if (attrs && attrs.lastCycle && attrs.lastCycle.beg !== 0) {
        var tabId = App.util.makeId();
        var timeRange = {
          beg: attrs.lastCycle.beg,
          end: attrs.lastCycle.end,
        };
        App.publish('VehicleRequested',
            [attrs.id, tabId, attrs.title, timeRange]);
      }
      return this;
    },

    configure: function (e) {
      var attrs = this.getRowAttributesFromChild(e.target);
      App.api.fetchVehicleConfig(attrs.id, function (err, xml) {
        if (err) return alert(err.toString());
        App.editorView.open('<span style="font-weight:normal;">Configure Vehicle:</span> ' +
            attrs.title + ' (' + attrs.id + ')', xml, function (data, cb) {
          App.api.saveVehicleConfig(attrs.id, data, cb);
        });
      });
    },

    getRowAttributesFromChild: function (child) {
      var tr = $(child).closest('tr');
      var id = tr.attr('id');
      if (!id) return;
      var items = id.split('_');
      var time = parseInt($('[data-time]', tr).attr('data-time'));
      return {
        id: parseInt(items[items.length - 1]),
        title: tr.attr('data-title'),
        lastCycle: time === 0 ? null :
            JSON.parse($('[data-cycle]', tr).attr('data-cycle')),
      };
    },

  });
});

