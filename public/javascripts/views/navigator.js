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
      var self = this, data = _.pluck(self.collection.models, 'attributes');
          bounds = [], shapes = [],
          holder = $('.navigator > div', this.content);
      bounds = [
        _.min(_.pluck(data, 'beg')) / 1000,
        _.max(_.pluck(data, 'end')) / 1000
      ];
      _.each(data, function (pnt) {
        // left edge of box
        shapes.push({
          xaxis: {
            from: pnt.beg / 1000,
            to: pnt.beg / 1000,
          },
          color: '#aaa',
        });
        // box
        shapes.push({
          xaxis: {
            from: pnt.beg / 1000,
            to: pnt.end / 1000,
          },
          color: '#eee',
        });
      });
      var pad = 60 * 60 * 1000;
      var plot = $.plot(holder,
          [[bounds[0], 0], [bounds[1], 1]], {
        xaxis: {
          // show: false,
          mode: 'time',
          tickLength: 0,
          min: bounds[0] - pad,
          max: bounds[1] + pad,
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
          shadowSize: 0,
        },
        grid: {
          // show: true,
          // aboveData: boolean,
          color: '#ff0000',
          // backgroundColor: null,
          // labelMargin: 50,
          // axisMargin: 20,
          markings: shapes,
          borderWidth: 0,
          // minBorderMargin: -20,
          // clickable: true,
          // hoverable: true,
          // autoHighlight: true,
          // mouseActiveRadius: number
        },
        // selection: { mode: 'x' },
        zoom: {
          interactive: true,
          amount: 1.1,
        },
        pan: {
          interactive: true,
        },
        hooks: {
          draw: [_.debounce(addIcons, 20)],
        },
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
        // TODO: only zooms in when hovering img and wheeling
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
      
      
      

      // draw a little arrow on top of the last label to demonstrate
      // canvas drawing
      // var ctx = plot.getCanvas().getContext("2d");
      // ctx.beginPath();
      // o.left += 4;
      // ctx.moveTo(o.left, o.top);
      // ctx.lineTo(o.left, o.top - 10);
      // ctx.lineTo(o.left + 10, o.top - 5);
      // ctx.lineTo(o.left, o.top);
      // ctx.fillStyle = "#000";
      // ctx.fill();

      $('.navigator', this.content).data({ plot: plot });

      return this;
    },

  });
});

