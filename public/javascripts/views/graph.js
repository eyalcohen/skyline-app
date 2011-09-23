/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'plot_booter'], 
    function (DashItemView) {

  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts, fn) {
      console.log('Rendering...');
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
      this.plot = null;
      this.el = App.engine('graph.dash.jade', opts).appendTo(parent);
      this._super('render', fn);
      console.log('Rendering done...');
    },

    createPlot: function() {
      this.render();  // Why is this necessary?
      // Create empty graph.
      this.plot = $.plot($('.graph > div', this.content), [], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          tickLength: 5,
          min: (new Date(2011, 1, 1)).getTime(),
          max: (new Date(2012, 1, 1)).getTime(),
        },
        yaxis: {
          tickLength: 5,
          reserveSpace: 100,
          labelWidth: 30,
          zoomRange: false,
          panRange: false,
        },
        xaxes: [{}],
        yaxes: [{}],
        series: {
          lines: {
            show: true,
            lineWidth: 1,
            fill: 0.2,
            // fillColor: null or color/gradient
            // steps: true,
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
          // show: true,
          // aboveData: boolean,
          // color: color,
          // backgroundColor: null,
          // labelMargin: 50,
          // axisMargin: 20,
          markings: weekendAreas,
          borderWidth: 0.5,
          borderColor: '#999',
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
      this.plot.hooks.draw.push(_.bind(this.plotDrawHook, this));

      $('.graph', this.content).data({plot: this.plot});

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
          markings.push({ xaxis: { from: i, to: i + 2*24*60*60*1000 } });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);
        return markings;
      }
    },

    draw: function () {
      var self = this;
      if (!self.plot)
        self.createPlot();
      var attr = self.model.attributes;
      var modelData = self.model.get('data');
      var data = self.model.get('channels').map(function(channel) {
        return modelData[channel.channelName] || [];
      });
      self.plot.setData(data);
      // TODO: labels, colors.
      self.plot.setupGrid();
      self.plot.draw();
    },

    plotDrawHook: function() {
      console.log('plotDrawHook called!');
      var t = this.getVisibleTime();
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        this.trigger('VisibleTimeChange', t.beg, t.end);
        console.log('VisibleTimeChange', t.beg, t.end);
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
      if (t.width != this.prevWidth) {
        this.trigger('VisibleWidthChange', t.width);
        console.log('VisibleWidthChange', t.width);
        this.prevWidth = t.width;
      }
    },

    /*
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
      // Update graph.
      if (!this.plot)
        this.createPlot();
      return this;
    },
    */

    getVisibleTime: function() {
      if (!this.plot) return null;
      var xopts = this.plot.getAxes().xaxis.options;
      return { beg: xopts.min * 1000, end: xopts.max * 1000,
               width: this.plot.width() };
    },

    setVisibleTime: function(beg, end) {
      var xopts = this.plot.getAxes().xaxis.options;
      beg /= 1000; end /= 1000;
      if (beg != xopts.min || end != xopts.max) {
        xopts.min = beg;
        xopts.max = end;
        this.plot.setupGrid();  // Necessary?
        this.plot.draw();
      }
    },

  });
});









