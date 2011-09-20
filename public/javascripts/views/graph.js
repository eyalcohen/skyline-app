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
      this.el = App.engine('graph.dash.jade', opts).appendTo(parent);
      this._super('render');
      if (!this.firstRender && !opts.loading 
            && !opts.waiting && !opts.empty) {
        this.draw();
      }
      return this;
    },

    draw: function () {
      $.plot($('.graph > div', this.content),
          [this.model.attributes.data], {
        xaxes: [{
          mode: 'time',
          position: 'bottom',
          tickLength: 5,
          // zoomRange: [0.1, 10],
          // panRange: [-10, 10],
          // min: (new Date(1990, 1, 1)).getTime(),
          // max: (new Date(2000, 1, 1)).getTime(),
        }],
        yaxes: [{
          position: 'left',
          tickLength: 5,
          // zoomRange: [0.1, 10],
          // panRange: [-10, 10],
          // min: 20,
        }],
        series: {
          lines: {
            show: true,
            lineWidth: 1,
            fill: 0.2,
            // fillColor: null or color/gradient
            steps: true,
          },
          points: {
            // show: true
            // radius: number
            // symbol: "circle" or function
          },
          bars: {
            // barWidth: number
            // align: "left" or "center"
            // horizontal: boolean
          },
          shadowSize: 1,
        },
        grid: {
          show: true,
          // aboveData: boolean,
          // color: color,
          backgroundColor: null,
          // labelMargin: 50,
          // axisMargin: 20,
          markings: weekendAreas,
          borderWidth: 1,
          borderColor: '#CCC',
          minBorderMargin: 30,
          clickable: true,
          hoverable: true,
          autoHighlight: true,
          // mouseActiveRadius: number
        },
        crosshair: { mode: 'xy' },
        // selection: { mode: "xy" },
        zoom: {
          interactive: true,
        },
        pan: {
          interactive: true,
        },
      });

      // helper for returning the weekends in a period
      function weekendAreas(axes) {
        var markings = [];
        var d = new Date(axes.xaxis.min);
        // go to the first Saturday
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7))
        d.setUTCSeconds(0);
        d.setUTCMinutes(0);
        d.setUTCHours(0);
        var i = d.getTime();
        do {
          // when we don't set yaxis, the rectangle automatically
          // extends to infinity upwards and downwards
          markings.push({ xaxis: { from: i, to: i + 2 * 24 * 60 * 60 * 1000 } });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);

        return markings;
      }

      return this;
    },

  });
});









