/*!
 * Copyright 2011 Mission Motors
 */

define([ 'views/dashitem', 'plot_booter', 'libs/jquery.simplemodal-1.4.1' ],
    function (DashItemView) {

  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'click .export': 'exportCsv',
      'click .add-graph': 'addGraphFromParent',
      'click .remove-graph': 'removeGraphFromParent',
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
      var self = this;
      self.render(); // Why is this necessary?
      // Create empty graph.
      self.plot = $.plot($('.graph > div', self.content), [], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          min: (new Date(2011, 1, 1)).getTime(),
          max: (new Date(2012, 1, 1)).getTime(),
          tickColor: '#ddd',
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 30,
          zoomRange: false,
          panRange: false,
          tickColor: '#ddd',
        },
        yaxes: [
          { position: 'left' },
          { position: 'right', alignTicksWithAxis: 1 }
        ],
        series: {
          lines: {
            lineWidth: 1,
          },
          points: {},
          bars: {},
          shadowSize: 1,
        },
        grid: {
          markings: weekendAreas,
          borderWidth: 0.5,
          borderColor: '#444',
          clickable: true,
          hoverable: true,
          autoHighlight: true,
        },
        crosshair: { mode: 'xy' },
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
          labelFormatter: function(label, series) {
            return '<span class="jstree-draggable">' + label + '</span>&nbsp;&nbsp;&nbsp;<a href="javascript:;" class="label-closer" '+
                'data-channel-name="' + series.channel.channelName + '">X</a>';
          },
        },
      });
      self.plot.hooks.draw.push(_.bind(self.plotDrawHook, self));

      $('.graph', self.content).data({
        plot: self.plot,
        id: self.options.id,
      });

      // helper for returning the weekends in a period
      function weekendAreas(axes) {
        var markings = [];
        var d = new Date(axes.xaxis.min);
        // go to the first Saturday
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
        d.setUTCSeconds(0);
        d.setUTCMinutes(0);
        d.setUTCHours(0);
        var i = d.getTime();
        do {
          markings.push({ xaxis: { from: i, to: i + 2*24*60*60*1000 }, color: '#fcfcfc' });
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
      var series = [], numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
      // so many loops, ugh... seems to be only way
      // to ensure proper axis mapping.
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesLeftAxis++;
        else
          numSeriesRightAxis++;
      });
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum) {
          if (numSeriesLeftAxis > numSeriesRightAxis) {
            channel.yaxisNum = 2;
            numSeriesRightAxis++;
          } else {
            channel.yaxisNum = 1;
            numSeriesLeftAxis++;
          }
        }
      });
      if (numSeriesLeftAxis === 0 && numSeriesRightAxis !== 0) {
        _.each(self.model.get('channels'), function (channel) {
          channel.yaxisNum = 1;
        });
      }
      _.each(self.model.get('channels'), function (channel) {
        var data = self.model.get('data')[channel.channelName] || [];
        series.push({
          color: channel.colorNum,
          lines: {
            show: true,
            lineWidth: 1,
            fill: false,
          },
          data: data,
          label: channel.units ?
              channel.title + ' (' + channel.units + ')' :
              channel.title,
          xaxis: 1,
          yaxis: channel.yaxisNum,
          channel: channel,
        });
      });
      _.each(self.model.get('channels'), function (channel) {
        var dataMinMax =
            self.model.get('dataMinMax')[channel.channelName] || [];
        if (dataMinMax.length === 0) return;
        series.push({
          color: channel.colorNum,
          lines: {
            show: true,
            lineWidth: 0,
            fill: 0.6,
          },
          data: dataMinMax,
          xaxis: 1,
          yaxis: channel.yaxisNum,
        });
      });
      self.plot.setData(series);
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
      this.addYaxesBoundsForDrops();
      $('.label-closer', this.content).click(_.bind(this.removeChannel, this));
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

    addYaxesBoundsForDrops: function () {
      var self = this;
      $('.axisTarget', self.content).remove();
      var parentPadding = {
        lr: Math.ceil((self.content.width() -
            self.plot.getPlaceholder().width()) / 2),
        tb: Math.ceil((self.content.height() -
            self.plot.getPlaceholder().height()) / 2),
      };
      _.each(self.plot.getAxes(), function (axis, key) {
        if (key === 'xaxis') return;
        var box = getBoundingBoxForAxis(axis);
        var borderLeft = key === 'yaxis' ?
            '' : '1px dashed rgba(0, 0, 0, 0.5)';
        var borderRight = key === 'y2axis' ?
            '' : '1px dashed rgba(0, 0, 0, 0.5)';
        $('<div class="axisTarget jstree-drop" style="position:absolute;left:' +
            box.left + 'px;top:' + box.top + 'px;width:' + box.width +
            'px;height:' + box.height + 'px"></div>')
            .data('axis.direction', axis.direction)
            .data('axis.n', axis.n)
            .data('dragover', function () { $(this).css({ opacity: 1 }) })
            .data('dragout', function () { $(this).css({ opacity: 0 }) })
            .css({
              backgroundColor: 'rgba(128,255,255,0.1)',
              'border-left': borderLeft,
              'border-right': borderRight,
              opacity: 0,
            })
            .appendTo(self.plot.getPlaceholder());
      });
      // helper for returning axis bounds
      function getBoundingBoxForAxis (axis) {
        var left = axis.box.left,
            top = -parentPadding.tb,
            right = left + axis.box.width;
        var width = right - left,
            height = self.content.height() + 1;
        if (axis.position === 'left') {
          left -= parentPadding.lr + 1;
          width += parentPadding.lr;
        } else {
          width += parentPadding.lr;
        }
        return { left: left, top: top,
              width: width, height: height };
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
      $('[value="noResample"]', d).get(0).checked = true;
      // TODO: rather than this rather horrible technique of updating every
      // 100ms, bind to the various events that occur when dialog controls
      // change.
      var linkUpdater = setInterval(updateLink, 100);

      function updateLink() {
        var link = $('a#download', d);
        // if (!link.length) return;
        // TODO: use some kind of URL builder to deal with escaping.
        var viewRange = self.getVisibleTime();
        var resample = $('[value="resample"]', d).get(0).checked;
        var minmax = $('[name="minmax"]', d).get(0).checked;
        $('[name="minmax"]', d).get(0).disabled = !resample;
        var resampleTime = $('#resample').get(0).value;
        // TODO: calculate how many data points we'll generate with a resample,
        // and give some kind of warning or something if it's ridiculous.
        // TODO: make the link force download?
        $('a#download', d).get(0).href = '/export/' +
            self.model.get('vehicleId') + '/data.csv' +
            '?beg=' + Math.floor(viewRange.beg) +
            '&end=' + Math.ceil(viewRange.end) +
            (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
            (resample && minmax ? '&minmax' : '') +
            channels.map(function(c){return '&chan=' + c.channelName}).join('');
      }

      return self;
    },

    removeChannel: function (e) {
      var label = $(e.target).attr('data-channel-name');
      console.log(label);
      this.trigger('ChannelUnrequested', label);
    },

    addGraphFromParent: function (e) {
      this.trigger('addGraph');
    },

    removeGraphFromParent: function (e) {
      this.trigger('removeGraph');
    },

  });
});

