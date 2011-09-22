/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'plot_booter'], 
    function (DashItemView) {
  return DashItemView.extend({
    // initialize: function (args) {
    //   this._super('initialize');
    //   this.colorCnt = 1;
    //   return this;
    // },

    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts, fn) {
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
      this._super('render', _.bind(function () {
        if (!this.firstRender && !opts.loading 
              && !opts.waiting && !opts.empty) {
          if (fn) fn();
        }
      }, this));
    },

    draw: function () {
      var self = this, series = [], yaxes = [],
          data = self.model.attributes.data;
      // var tmp = ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"];
      var tmp = ["#aa8b2e", "#657d8f", "#cb4b4b", "#4da74d", "#9440ed"];
      _.each(data, function (ser, i) {
        series.push({
          color: self.model.attributes.colors[i],
          data: ser,
          label: self.model.attributes.labels[i],
          // lines: specific lines options,
          // bars: specific bars options,
          // points: specific points options,
          xaxis: 1,
          yaxis: i+1,
          clickable: true,
          hoverable: true,
          // shadowSize: number,
        });
        yaxes.push({
          position: ['left','right'][i%2],
          color: tmp[self.model.attributes.colors[i]],
        });
      });
      var plot =
          $.plot($('.graph > div', this.content),
          series, {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          tickLength: 5,
          // zoomRange: [0.1, 10],
          // panRange: [-10, 10],
          // min: (new Date(1990, 1, 1)).getTime(),
          // max: (new Date(2000, 1, 1)).getTime(),
        },
        yaxis: {
          tickLength: 5,
          reserveSpace: 100,
          labelWidth: 30,
          zoomRange: false,
          panRange: false,
        },
        xaxes: [{}],
        yaxes: yaxes,
        series: {
          lines: {
            show: true,
            lineWidth: 1,
            fill: 0.2,
            // fillColor: null or color/gradient
            // steps: true,
          },
          points: {
            show: true
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
          // show: true,
          // aboveData: boolean,
          // color: '#00ff00',
          // backgroundColor: null,
          // labelMargin: 50,
          // axisMargin: 20,
          markings: weekendAreas,
          borderWidth: 0.5,
          borderColor: '#ccc',
          // minBorderMargin: 30,
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
      $('.graph', this.content).data({plot: plot});

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
          markings.push({ xaxis: { from: i, to: i + 2 * 24 * 60 * 60 * 1000 } });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);

        return markings;
      }

      return this;
    },

  });
});

