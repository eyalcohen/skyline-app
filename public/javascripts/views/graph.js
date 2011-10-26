/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter',
    'libs/jquery.simplemodal-1.4.1.min'],
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      _.bindAll(this, 'destroy', 'showNotification', 'hideNotification',
                'mouseHoverTime');
      var tabId = args.tabId;
      App.subscribe('PreviewNotification-' + tabId, this.showNotification);
      App.subscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.subscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
    },

    destroy: function () {
      this._super('destroy');
      var tabId = this.options.tabId;
      App.unsubscribe('PreviewNotification-' + tabId, this.showNotification);
      App.unsubscribe('UnPreviewNotification-' + tabId, this.hideNotification);
      App.unsubscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
    },

    events: {
      'click .toggler': 'toggle',
      'click .export': 'exportCsv',
      'click .add-graph': 'addGraphFromParent',
      'click .graph-closer': 'removeGraphFromParent',
    },

    render: function (opts, fn) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.plot = null;
      this.el = App.engine('graph.dash.jade', opts)
          .appendTo(this.options.parent);
      this.mouseTime = $('.mouse-time', this.el);
      this.mouseTimeTxt = $('span', this.mouseTime);
      this.notificationPreview = $('.notification-preview', this.el);
      this.minHoverDistance = 10;
      this.highlighting = false;
      this._super('render', fn);
      this.draw();
    },

    createPlot: function () {
      var self = this;
      self.colors = [
        "#28A128",  // Dark green
        "#cb4b4b",  // Dark red
        "#118CED",  // Dark blue
        "#E8913F",  // Orange
        "#9440ed",  // Dark purple
        "#27CDD6",  // Dark cyan
        "#B2B848",  // Dark yellow
        "#8171E3",  // Violet
        "#CC6ABE",  // Dark magenta
        "#47A890",  // Dark teal
        "#7A7A7A",  // Gray
        "#76D676",  // Light green
        "#FFA6A6",  // Pink
        "#96BDFF",  // Light blue
        "#D373FF",  // Light purple
      ];
      self.plot = $.plot($('.graph > div', self.content), [], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          min: self.options.timeRange.beg / 1e3,
          max: self.options.timeRange.end / 1e3,
          tickColor: '#f0f0f0',
          labelsInside: true,
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 0,
          zoomRange: false,
          panRange: false,
          tickColor: '#f0f0f0',
          labelsInside: true,
        },
        yaxes: [
          { position: 'left' },
          { position: 'right', alignTicksWithAxis: 1 }
        ],
        series: {
          lines: { lineWidth: 1 },
          points: {},
          bars: {},
          shadowSize: 1,
        },
        grid: {
          markings: weekendAreas,
          backgroundColor: null,
          borderWidth: 0,
          borderColor: null,
          clickable: false,
          hoverable: false,
          autoHighlight: false,
          minBorderMargin: 0,
          fullSize: true,
        },
        crosshair: { mode: 'x' },
        zoom: {
          interactive: false,  // We implement zooming event handlers ourselves.
        },
        pan: {
          interactive: true,
          frameRate: 60,
        },
        legend: {
          margin: [40, 0],
          oneperyaxis: true,
          labelFormatter: function(label, series) {
            return "<div data-channel='" + JSON.stringify(series.channel) + "' "+
                'data-channel-name="' + series.channel.channelName + '">'+
                '<span class="jstree-draggable" style="cursor:pointer">'+
                label + '</span></div>';
          },
        },
        // colors: self.colors,
        hooks: {
          draw: [_.bind(self.plotDrawHook, self)],
          setupGrid: [_.bind(self.plotSetupGridHook, self)],
          bindEvents: [bindEventsHook],
        },
      });
      self.plot.lockCrosshair();  // Disable default crosshair movement.

      $('.graph', self.content).data({
        plot: self.plot,
        id: self.options.id,
      });

      function bindEventsHook(plot, eventHolder) {
        plot.getPlaceholder().mousemove(function (e) {
          var mouse = {
            x: e.pageX - parseInt(plot.offset().left),
            y: e.pageY - parseInt(plot.offset().top),
          };
          var xaxis = plot.getXAxes()[0];
          var time = xaxis.c2p(mouse.x);
          // If we're hovering over the legend, don't do data mouseover.
          if (inLegend(e.target))
            mouse = null;
          App.publish('MouseHoverTime-' + self.model.get('tabId'),
                      [time * 1e3, mouse, self]);
        })
        .mouseleave(function (e) {
          App.publish('MouseHoverTime-' + self.model.get('tabId'), [null]);
        })
        .mousewheel(function (e, delta) {
          graphZoomClick(e, e.shiftKey ? 2 : 1.25, delta < 0);
          return false;
        })
        .dblclick(function (e) {
          graphZoomClick(e, e.shiftKey ? 8 : 2, e.altKey || e.metaKey);
        });

        function graphZoomClick(e, factor, out) {
          var c = plot.offset();
          c.left = e.pageX - c.left;
          c.top = e.pageY - c.top;
          if (out)
            plot.zoomOut({ center: c, amount: factor });
          else
            plot.zoom({ center: c, amount: factor });
        }
      }

      function inLegend(elem) {
        while (elem) {
          if (elem.className == 'legend') return true;
          elem = elem.parentNode;
        }
        return false;
      }

      function weekendAreas(axes) {
        var markings = [];
        var d = new Date(axes.xaxis.min);
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
        d.setUTCSeconds(0);
        d.setUTCMinutes(0);
        d.setUTCHours(0);
        var i = d.getTime();
        do {
          markings.push({
            xaxis: { from: i, to: i + 2*24*60*60*1000 },
            color: '#fcfcfc',
          });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);
        return markings;
      }
    },

    draw: function () {
      var self = this;
      if (!self.plot)
        self.createPlot();
      if (self.model.get('channels').length === 0) {
        $('<div><span>Drop data channels here to display.</span></div>')
            .addClass('empty-graph').appendTo(self.content);
        $('canvas', self.plot.getPlaceholder()).hide();
        self.plot.getOptions().crosshair.mode = null;
      } else {
        var emptyDiv = $('.empty-graph', self.content);
        if (emptyDiv.length > 0) {
          emptyDiv.remove();
          $('canvas', self.plot.getPlaceholder()).show();
          self.plot.getOptions().crosshair.mode = 'x';
        }
      }
      var opts = self.plot.getOptions();
      var numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum) return;
        if (channel.yaxisNum === 1)
          numSeriesLeftAxis++;
        else
          numSeriesRightAxis++;
      });
      var yAxisNumToUse = numSeriesLeftAxis > numSeriesRightAxis ? 2 : 1;
      _.each(self.model.get('channels'), function (channel) {
        if (!channel.yaxisNum)
          channel.yaxisNum = yAxisNumToUse;
      });
      var dataSeries = [], minMaxSeries = [], highlightSeries = [];
      _.each(self.model.get('channels'), function (channel) {
        var data = self.model.data[channel.channelName] || [];
        var highlighted = self.highlighting === channel.channelName;
        var color = self.colors[channel.colorNum % self.colors.length];
        if (self.highlighting && !highlighted) {
          // Lighten color.
          color = $.color.parse(color);
          color.r = Math.round((color.r + 255*2) / 3);
          color.g = Math.round((color.g + 255*2) / 3);
          color.b = Math.round((color.b + 255*2) / 3);
          color = color.toString();
        }
        var newDataSeries = {
          color: color,
          lines: {
            show: true,
            lineWidth: 1,
            fill: false,
          },
          data: data,
          label: channel.title,
          xaxis: 1,
          yaxis: channel.yaxisNum,
          channel: channel,
        };
        var dataMinMax = self.model.dataMinMax[channel.channelName] || [];
        var newMinMaxSeries = {
          color: color,
          lines: {
            show: true,
            lineWidth: 0,
            fill: 0.6,
          },
          data: dataMinMax,
          xaxis: 1,
          yaxis: channel.yaxisNum,
        };
        if (highlighted) {
          if (dataMinMax.length)
            highlightSeries.push(newMinMaxSeries);
          highlightSeries.push(newDataSeries);
        } else {
          if (dataMinMax.length)
            minMaxSeries.push(newMinMaxSeries);
          dataSeries.push(newDataSeries);
        }
      });
      self.plot.setData(
          [].concat.call(minMaxSeries, dataSeries, highlightSeries));
      self.plot.setupGrid();
      self.plot.draw();
    },

    setupLabels: function () {
      this.plot.setupLabels();
      this.addYaxesBoundsForDrops();
      $('.label-closer', this.content)
          .click(_.bind(this.removeChannel, this));
      $('.legend tr', this.content)
          .bind('mouseenter', _.bind(this.enterLegend, this))
          .bind('mouseout', _.bind(this.leaveLegend, this));
    },

    plotSetupGridHook: function() {
      if (!this.plot) return;
      var xopts = this.plot.getAxes().xaxis.options;
      var xmin = xopts.min, xmax = xopts.max;
      var yAxes = this.plot.getYAxes();
      // Automatically change Y-axis bounds based on visible data.
      yAxes.forEach(function(axis) {
        axis.datamin = Infinity;
        axis.datamax = -Infinity;
      });
      // TODO: this is ugly, and probably slow.
      this.plot.getData().forEach(function(series) {
        var max = series.yaxis.datamax, min = series.yaxis.datamin;
        var prevTime = null;
        series.data.forEach(function(p) {
          if (p && prevTime && p[0] >= xmin && prevTime <= xmax) {
            max = Math.max(max, p[1]);
            min = Math.min(min, p[2] == null ? p[1] : p[2]);
          }
          prevTime = p && p[0];
        });
        series.yaxis.datamax = max;
        series.yaxis.datamin = min;
      });
      yAxes.forEach(function(axis) {
        if (!(isFinite(axis.datamin) && isFinite(axis.datamax))) {
          axis.datamin = 0; axis.datamax = 1;
        } else if (axis.datamin == axis.datamax) {
          axis.datamin -= 0.5; axis.datamax += 0.5;
        }
      });

      var self = this;
      if (!self.prevNumChannels || self.prevNumChannels !== 
            self.model.get('channels').length || App.forceRedraw) {
        self.setupLabels();
        if (App.forceRedraw)
          App.forceRedraw = false;
      }
      self.prevNumChannels = self.model.get('channels').length;
    },

    plotDrawHook: function() {
      var lastHover = this.lastHoverTime;
      if (lastHover)
        this.mouseHoverTime(lastHover.time, lastHover.mouse, lastHover.graph);
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        this.trigger('VisibleTimeChange', t.beg, t.end);
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
      if (t.width != this.prevWidth) {
        this.trigger('VisibleWidthChange', t.width);
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
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    mouseHoverTime: function(time, mouse, graph) {
      var self = this;
      self.lastHoverTime = { time: time, mouse: mouse, graph: graph };

      if (time != null)
        time = time / 1e3;

      if (time == null)
        self.plot.clearCrosshair();
      else
        self.plot.setCrosshair({x: time});

      if (time != null) {
        self.mouseTime.show();
        // TODO: finer than 1 second granularity.
        self.mouseTimeTxt.text(new Date(Math.round(time)).toString());
      } else {
        self.mouseTime.hide();
      }

      // TODO: clean up labels - pass full html as flot option
      // and remove flot hackery.
      if (self.closestSeriesLabel) {
        self.closestSeriesLabel.removeClass('label-highlight');
        self.axisTargets.css({ cursor: 'crosshair' });
      }
      self.closestSeriesLabel = null;
      var minDist = Infinity;
      _.each(self.plot.getData(), function (series) {
        if (!series.channel) return;
        var labelSibling = $('.legendLabel > div[data-channel-name="'+
            series.channel.channelName+'"]', self.el);
        var labelParent = labelSibling.parent().parent();
        var label = $('.legendValue', labelParent);
        var valueHTML = '';
        if (time != null &&
            time >= series.xaxis.datamin && time <= series.xaxis.datamax) {
          var hoveredPnt = _.detect(series.data, function(p, i) {
            var prev = series.data[i-1];
            return prev && p && prev[0] <= time && time < p[0] && p;
          });
          if (hoveredPnt) {
            if (graph === self && mouse) {
              var dy = Math.abs(series.yaxis.p2c(hoveredPnt[1]) - mouse.y);
              if (dy <= minDist) {
                minDist = dy;
                self.closestSeriesLabel = labelParent;
              }
            }
            var v = hoveredPnt[1];
            if (Math.abs(Math.round(v)) >= 1e6)
              v = v.toFixed(0);
            else {
              // Limit to 6 digits of precision (converting very small numbers
              // to e.g. '1.23400e-8'), strip zeros trailing the decimal
              // point, and strip the decimal point itself if necessary.
              // JavaScript number formatting sucks!
              v = v.toPrecision(6).
                  replace(/(\.[0-9]*?)0*([Ee][0-9-]*)?$/, '$1$2').
                  replace(/\.([Ee][0-9-]*)?$/, '$1');
            }
            valueHTML = self.addCommas(v);
          }
        }
        label.html(valueHTML);
      });
      if (self.closestSeriesLabel &&
            minDist <= self.minHoverDistance) {
        self.closestSeriesLabel.addClass('label-highlight');
        self.axisTargets.css({ cursor: 'pointer' });
      }
    },

    addYaxesBoundsForDrops: function () {
      var self = this;
      if (self.axisTargets)
        self.axisTargets.remove();
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
        $('<div>')
            .data({
              'axis.direction': axis.direction,
              'axis.n': axis.n,
              dragover: function () { $(this).css({ opacity: 1 }) },
              dragout: function () { $(this).css({ opacity: 0 }) },
            })
            .css({
              position: 'absolute',
              left: (axis.n - 1) * self.plot.width() / 2,
              top: box.top,
              width: self.plot.width() / 2,
              height: box.height,
              backgroundColor: 'rgba(128,255,255,0.1)',
              'border-left': borderLeft,
              'border-right': borderRight,
              opacity: 0,
            })
            .addClass('axisTarget')
            .addClass('jstree-drop')
            .appendTo(self.plot.getPlaceholder())
            // TODO: modularize this cause its useful elsewhere.
            .bind('click mousedown mouseup mouseenter mouseleave '+
                'mousewheel mousemove', function (e) {
              if (App.isDragging) return;
              if (e.preventDefault) e.preventDefault();
              var $this = $(this);
              $this.hide();
              var receiver =
                  document.elementFromPoint(e.clientX,e.clientY);
              if (receiver.nodeType == 3) // Opera
                receiver = receiver.parentNode;
              var delta = e.wheelDelta ? (e.wheelDelta / Math.abs(e.wheelDelta)) *
                  ((self.plot.getOptions().zoom.amount - 1) / 10) : null;
              $(receiver).trigger(e, [delta]);
              $this.show();
            });
      });

      self.axisTargets = $('.axisTarget', self.el);

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

    showNotification: function (range, other) {
      var xaxis = this.plot.getXAxes()[0];
      var leftSide = Math.max(xaxis.p2c(range.beg/1e3), 0);
      var rightSide = Math.min(xaxis.p2c(range.end/1e3), this.plot.width());
      if (leftSide < this.plot.width() && rightSide > 0) {
        this.notificationPreview.css({
          left: leftSide + 'px',
          width: rightSide - leftSide + 'px',
        }).show();
      }
    },

    hideNotification: function () {
      this.notificationPreview.hide();
    },

    // center: function (time) {
    //   var currentCenterTime = this.plot.getOptions().xaxis.max -
    //       this.plot.getOptions().xaxis.min;
    //   var timeShift = time - currentCenterTime;
    //   var min = this.plot.getOptions().xaxis.min - timeShift;
    //   var max = this.plot.getOptions().xaxis.max - timeShift;
    //   App.publish('VisibleTimeChange-' + this.options.tabId,
    //       [min * 1e3, max * 1e3]);
    // },

    exportCsv: function (e) {
      var self = this;
      e.preventDefault();
      var channels = [
          { channelName: '$beginDate', title: 'Begin Date' },
          { channelName: '$beginTime', title: 'Begin Time' },
          { channelName: '$beginRelTime', title: 'Begin Since Start', units: 's' },
          { channelName: '$endRelTime', title: 'End Since Start', units: 's' },
        ].concat(self.model.get('channels'));
      App.engine('export_csv.dialog.jade',
          { channels: channels }).appendTo('body').modal({
        overlayId: 'osx-overlay',
        containerId: 'osx-container',
        closeHTML: null,
        minHeight: 80,
        opacity: 65,
        position: ['0',],
        overlayClose: true,
        onOpen: function (d) {
          var self = this;
          self.container = d.container[0];
          d.overlay.fadeIn('fast', function () {
            $('#osx-modal-content', self.container).show();
            var title = $('#osx-modal-title', self.container);
            title.show();
            d.container.slideDown('fast', function () {
              setTimeout(function () {
                var h = $('#osx-modal-data', self.container).height()+
                    title.height() + 20;
                d.container.animate({ height: h }, 200, function () {
                  $('div.close', self.container).show();
                  $('#osx-modal-data', self.container).show();
                });
              }, 300);
            });
          });
        },
        onClose: function (d) {
          var self = this;
          d.container.animate({ top:'-' + (d.container.height() + 20) }, 300,
              function () {
            self.close();
            $('#osx-modal-content').remove();
          });
        },
      });
      $('[value="noResample"]').attr('checked', true);
      $('[name="minmax"]').attr('disabled', true);
      $('[name="sampleType"]').click(onSampleTypeClick);
      function onSampleTypeClick(e) {
        $('[name="minmax"]').get(0).disabled =
            $('[value="noResample"]').is(':checked');
      }
      $('#resample').focus(onResampleTextClick).click(onResampleTextClick);
      function onResampleTextClick(e) {
        $('[value="resample"]').click();
        onSampleTypeClick();
      }
      $('#download-data').click(function (e) {
        var viewRange = self.getVisibleTime();
        var resample = !$('[value="noResample"]').is(':checked');
        var minmax = $('[name="minmax"]').is(':checked');
        var resampleTime = $('#resample').val();
        // TODO: calculate how many data points we'll generate with a resample,
        // and give some kind of warning or something if it's ridiculous.
        // TODO: maybe use the new download attribute on an anchor element?
        // http://html5-demos.appspot.com/static/a.download.html
        // We should really fetch the data via dnode then force the download
        // client-side... this way we can show a loading icon while the
        // user waits for the server to package everything up.
        var href = '/export/' +
            self.model.get('vehicleId') + '/data.csv' +
            '?beg=' + Math.floor(viewRange.beg) +
            '&end=' + Math.ceil(viewRange.end) +
            (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
            (resample && minmax ? '&minmax' : '') +
            channels.map(function(c){return '&chan=' + c.channelName}).join('');
        window.location.href = href;
      });
      return self;
    },

    enterLegend: function (e) {
      var row = $(e.target).closest('tr');
      var channelName = $('[data-channel-name]', row)
          .attr('data-channel-name');
      if (channelName === this.highlighting) return;
      this.highlighting = channelName;
      this.draw();
    },

    leaveLegend: function (e) {
      var receiver =
          document.elementFromPoint(e.clientX,e.clientY);
      if (receiver.nodeType == 3) // Opera
        receiver = receiver.parentNode;
      var row = $(receiver).closest('tr');
      if ($('[data-channel-name]', row).length > 0)
        return;
      this.highlighting = false;
      this.draw();
    },

    removeChannel: function (e) {
      var labelParent = $(e.target).parent().parent();
      var label = $('.legendLabel > div', labelParent);
      var channel = JSON.parse(label.attr('data-channel'));
      this.highlighting = false;
      this.trigger('ChannelUnrequested', channel);
    },

    addGraphFromParent: function (e) {
      App.forceRedraw = true;
      this.trigger('addGraph');
    },

    removeGraphFromParent: function (e) {
      App.forceRedraw = true;
      this.trigger('removeGraph');
    },

  });
});

