/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize');
      _.bindAll(this, 'drawWindow', 'moveWindow', 'hoverWindow');
      App.subscribe('VisibleTimeChange-' + args.vehicleId, this.drawWindow);
      App.subscribe('VisibleWidthChange-' + args.vehicleId, this.drawWindow);
    },
    
    events: {
      'click .toggler': 'toggle',
      'mousedown .navigator-window': 'moveWindow',
      'mousemove .navigator-window': 'hoverWindow',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('navigator.dash.jade', opts).appendTo(parent);
      this._super('render', _.bind(function () {
        if (!this.firstRender && !opts.loading 
              && !opts.waiting && !opts.empty) {
          this.draw();
        }
      }, this));
    },

    draw: function () {
      var self = this;
      var data = _.pluck(self.collection.models, 'attributes');
      var bounds = [], shapes = []
      var holder = $('.navigator > div', self.content);
      bounds = [
        _.min(_.pluck(data, 'beg')) / 1000,
        _.max(_.pluck(data, 'end')) / 1000
      ];
      _.each(data, function (pnt) {
        shapes.push({
          xaxis: {
            from: pnt.beg / 1000,
            to: pnt.beg / 1000,
          },
          color: '#999',
        });
        shapes.push({
          xaxis: {
            from: pnt.beg / 1000,
            to: pnt.end / 1000,
          },
          color: pnt.color,
        });
      });
      var pad = 60 * 60 * 1000;
      self.plot = $.plot(holder,
          [[bounds[0], 0], [bounds[1], 1]], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          // min: bounds[0] - pad,
          // max: bounds[1] + pad,
          min: (new Date(2011, 0, 1)).getTime(),
          max: (new Date(2012, 0, 1)).getTime(),
          tickColor: '#ddd',
          labelsInside: true,
          zoomRange: [1, (bounds[1] + pad) - (bounds[0] - pad)],
          panRange: [bounds[0] - pad, bounds[1] + pad],
        },
        yaxis: { 
          show: false,
          zoomRange: false,
          panRange: false,
        },
        series: {
          lines: { show: false },
          points: {},
          bars: {},
          shadowSize: 0,
        },
        grid: {
          markings: shapes,
          borderWidth: 0.5,
          borderColor: '#444',
          clickable: true,
          hoverable: true,
          autoHighlight: true,
          minBorderMargin: 0,
          fullSize: true,
        },
        zoom: {
          interactive: true,
          amount: 1.25,
        },
        hooks: { draw: [addIcons] },
      });

      function addIcons(p, ctx) {
        $('.icon', holder).remove();
        _.each(data, function (pnt) {
          var off = p.pointOffset({ x: pnt.beg / 1000, y: 0.22 });
          var icon = $('<img>')
              .attr({ src: pnt.icon })
              .css({
                left: off.left - 8 + 'px',
                top: off.top + 'px',
              })
              .addClass('icon')
              .appendTo(holder);
        });
        // FIXME: only zooms in when hovering img and wheeling
        $('img', holder).bind('mousedown, DOMMouseScroll, '+
            'mousewheel', function (e) {
          if (e.preventDefault) e.preventDefault();
          var $this = $(this);
          $this.hide();
          var receiver = document.elementFromPoint(e.clientX,e.clientY);
          if (receiver.nodeType == 3) { // Opera
            receiver = receiver.parentNode;
          }
          $(receiver).trigger(e);
          $this.show();
        });
      }
      $('.navigator', self.content).data({ plot: self.plot });
      self.box = $(self.options.parent + ' .navigator-window');
      
      App.publish('NavigableTimeChange-' + self.options.vehicleId,
          [(new Date(2011, 0, 1)).getTime() * 1000, (new Date(2012, 0, 1)).getTime() * 1000]);
      
      return self;
    },

    drawWindow: function (min, max) {
      var self = this;
      if (!self.box || self.box.length === 0) {
        self.box = $(self.options.parent + ' .navigator-window');
        return;
      }
      var lh = $(self.options.parent + ' .navigator-window-handle-left');
      var rh = $(self.options.parent + ' .navigator-window-handle-right');
      min = min / 1000;
      max = max / 1000;
      var off = $(self.options.parent).offset();
      var axis = self.plot.getXAxes()[0];
      var left = axis.p2c(min);
      var width = Math.max(axis.p2c(max) - left, 14);
      var top = parseInt(off.top) + 47;
      var display = '';
      if (left < 1) {
        width = width + left;
        left = 1;
        if (width <= 0)
          display = 'none';
      }
      if (left > self.el.width() - 1) {
        display = 'none';
      } else if (left + width > self.el.width() - 1) {
        width = self.el.width() - left + 1;
        if (width > self.el.width() - 1)
          width -= 1;
      }
      left = Math.floor(left + parseInt(off.left));
      width = Math.floor(width);
      self.box.css({
        display: display,
        left: left + 'px',
        width: width + 'px',
      });
      lh.css({
        display: display,
        left: left + 2 + 'px',
        top: top + 'px',
      });
      rh.css({
        display: display,
        left: left + width - 5 + 'px',
        top: top + 'px',
      });
    },

    moveWindow: function (e) {
      var self = this;
      var mouse_orig = { x: e.pageX, y: e.pageY };
      var boxLeft = parseInt(self.box.offset().left);
      var boxRight = boxLeft + self.box.width();
      var side = self.getWindowSide(e);
      var parentOff = parseInt(self.el.offset().left);
      var axis = self.plot.getXAxes()[0];
      var movehandle = _.debounce(function (e) {
        var m = { x: e.pageX, y: e.pageY };
        var delta = m.x - mouse_orig.x;
        var leftTime = !side || side === 'left' ?
            axis.c2p(boxLeft + delta - parentOff) :
            axis.c2p(boxLeft - parentOff);
        var rightTime = !side || side === 'right' ?
            axis.c2p(boxRight + delta - parentOff) :
            axis.c2p(boxRight - parentOff);
        App.publish('VisibleTimeChange-' + self.options.vehicleId,
            [leftTime * 1000, rightTime * 1000]);
      }, 0);
      $(document).bind('mouseup', function (e) {
        $(document).unbind('mousemove', movehandle)
            .unbind('mouseup', arguments.callee);
      });
      $(document).bind('mousemove', movehandle);
    },

    hoverWindow: function (e) {
      var side = this.getWindowSide(e);
      if (side == 'left')
        this.box.css({ cursor: 'e-resize' });
      else if (side == 'right')
        this.box.css({ cursor: 'w-resize' });
      else
        this.box.css({ cursor: 'move' });
    },

    getWindowSide: function (e) {
      var m = { x: e.pageX, y: e.pageY };
      var bl = parseInt(this.box.offset().left);
      var br = bl + this.box.width();
      var side;
      if (m.x - bl <= 8)
        return 'left';
      else if (br - m.x <= 8)
        return 'right';
      if (!side) return null;
    }

  });
});

