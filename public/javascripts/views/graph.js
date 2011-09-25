/*!
 * Copyright 2011 Mission Motors
 */

define([ 'views/dashitem', 'plot_booter', 'libs/jquery.simplemodal-1.4.1' ],
    function (DashItemView) {

  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click [value="Export"]': 'exportCsv',
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
      this.plot = null;
      this.el = App.engine('graph.dash.jade', opts).appendTo(parent);
      this._super('render', fn);
    },

    createPlot: function() {
      this.render();  // Why is this necessary?
      // Create empty graph.
      this.plot = $.plot($('.graph > div', this.content), [], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          min: (new Date(2011, 1, 1)).getTime(),
          max: (new Date(2012, 1, 1)).getTime(),
        },
        yaxis: {
          reserveSpace: 40,
          labelWidth: 30,
          zoomRange: false,
          panRange: false,
          // alignTicksWithAxis: 1,
        },
        xaxes: [{}],
        yaxes: [{}],
        series: {
          lines: {
            //show: true,
            //lineWidth: 1,
            //fill: 0.2,
          },
          points: {},
          bars: {},
          shadowSize: 1,
        },
        grid: {
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
          amount: 1.25,
        },
        pan: {
          interactive: true,
          frameRate: 60,
        },
        legend: {
          oneperyaxis: true,
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
      var opts = self.plot.getOptions();
      var series = [], yaxes = [];
      self.model.get('channels').forEach(function (channel, i) {
        var data = self.model.get('data')[channel.channelName] || [];
        series.push({
          color: attr.colors[i],
          lines: {
            show: true,
            lineWidth: 1,
            fill: false,
          },
          data: data,
          label: attr.labels[i],
          xaxis: 1,
          yaxis: i+1,
        });
      });
      self.model.get('channels').forEach(function (channel, i) {
        var dataMinMax =
            self.model.get('dataMinMax')[channel.channelName] || [];
        if (dataMinMax.length == 0) return;
        series.push({
          color: attr.colors[i],
          lines: {
            show: true,
            lineWidth: 0,
            fill: 0.4,
          },
          data: dataMinMax,
          xaxis: 1,
          yaxis: i+1,
        });
      });
      self.plot.setData(series);
      _.each(self.plot.getYAxes(), function (yaxis, i) {
        yaxis.options.position = ['left','right'][i%2];
        yaxis.options.tickFormatter = function (v) {
          return v + ' ' + attr.units[i];
        };
      });
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

    exportCsv: function (e) {
      var self = this;
      e.preventDefault();
      var channels = [
          { channelName: '$beginDate', title: 'Begin Date' },
          { channelName: '$beginTime', title: 'Begin Time' },
          { channelName: '$beginRelTime', title: 'Begin Since Start', units: 's' },
          { channelName: '$endRelTime', title: 'End Since Start', units: 's' },
        ].concat(self.model.get('channels'));
      var d = App.engine('export_csv.dialog.jade',
                         { channels: channels }).appendTo(self.content);
      var dialog = $(d).modal({
        closeHTML: "<a href='#' title='Close' class='modal-close'>x</a>",
        // position: ["20%",],
        overlayId: 'confirm-overlay',
        containerId: 'confirm-container',
        minHeight: 400,  // TODO: Why doesn't dialog auto-size?
        onClose: function() { clearInterval(linkUpdater); dialog.close(); },
      });
      var linkUpdater = setInterval(updateLink, 100);

      function updateLink() {
        var link = $('a#download', d);
        if (!link.length) return;
        // TODO: use some kind of URL builder to deal with escaping.
        var viewRange = self.getVisibleTime();
        var resample = $('[value="resample"]', d)[0].checked;
        var resampleTime = $('#resample')[0].value;
        // TODO: calculate how many data points we'll generate with a resample,
        // and give some kind of warning or something if it's ridiculous.
        // TODO: make the link force download?
        $('a#download', d)[0].href = '/export/' +
            self.model.attributes.vehicleId + '/data.csv' +
            '?beg=' + Math.floor(viewRange.beg) +
            '&end=' + Math.ceil(viewRange.end) +
            (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
            channels.map(function(c){return '&chan=' + c.channelName}).join('');
      }

      return self;
    },

  });
});
