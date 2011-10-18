/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'plot_booter',
    'libs/jquery.simplemodal-1.4.1.min'],
    function (DashItemView) {
  return DashItemView.extend({
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
      this._super('render', fn);
      this.draw();
    },

    createPlot: function () {
      var self = this;
      self.plot = $.plot($('.graph > div', self.content), [], {
        xaxis: {
          mode: 'time',
          position: 'bottom',
          min: self.options.timeRange.min,
          max: self.options.timeRange.max,
          tickColor: '#ddd',
          labelsInside: true,
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 0,
          zoomRange: false,
          panRange: false,
          tickColor: '#ddd',
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
          borderColor: '#444',
          clickable: false,
          hoverable: false,
          autoHighlight: false,
          minBorderMargin: 0,
          fullSize: true,
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
          margin: [40, 0],
          oneperyaxis: true,
          labelFormatter: function(label, series) {
            return "<div data-channel='" + JSON.stringify(series.channel) + "' "+
                'data-channel-name="' + series.channel.channelName + '">'+
                '<span class="jstree-draggable" style="cursor:pointer">'+
                label + '</span><span class="label-value"></span>'+
                '&nbsp;&nbsp;&nbsp;<a href="javascript:;"'+
                'class="label-closer">X</a></div>';
          },
        },
        colors: [
            "#28A128",  // Dark green
            "#cb4b4b",  // Dark red
            "#118CED",  // Dark blue
            "#E8913F",  // Orange
            "#9440ed",  // Dark purple
            "#27CDD6",  // Dark cyan
            "#CFD63E",  // Dark yellow
            "#8171E3",  // Violet
            "#CC6ABE",  // Dark magenta
            "#47A890",  // Dark teal
            "#7A7A7A",  // Gray
            "#76D676",  // Light green
            "#FFA6A6",  // Pink
            "#96BDFF",  // Light blue
            "#D373FF",  // Light purple
            ],
        hooks: {
          draw: [_.bind(self.plotDrawHook, self)],
          setupGrid: [_.bind(self.plotSetupGridHook, self)],
          bindEvents: [bindEventsHook],
        },
      });

      $('.graph', self.content).data({
        plot: self.plot,
        id: self.options.id,
      });

      function bindEventsHook(plot, eventHolder) {
        eventHolder.mousemove(function (e) {
          if (self.model.get('channels').length === 0) return;
          var mouseX = e.pageX - parseInt(plot.offset().left);
          var xaxis = plot.getXAxes()[0];
          var time = xaxis.c2p(mouseX);
          updateMouseTime(time);
          populateLabels(time);
          time *= 1e3;
          console.log('Hover at: ' + time);
          App.publish('MouseHoverTime-' + self.model.get('vehicleId'), [time]);
          // var pageX = pos.pageX - parseInt(plot.offset().left);
          // var mouseTimeWidth = self.mouseTime.outerWidth();
          // var left = pageX > plot.width() - mouseTimeWidth ?
          //     pageX - mouseTimeWidth + 'px' :
          //     pageX + 'px';
          // self.mouseTime.css({ left: left });
        })
        .mouseenter(function (e) {
          if (self.model.get('channels').length > 0)
            self.mouseTime.show();
        })
        .mouseleave(function (e) {
          if (self.model.get('channels').length > 0)
            self.mouseTime.hide();
          App.publish('MouseHoverTime-' + self.model.get('vehicleId'), [null]);
        });
      };

      function updateMouseTime(time) {
        self.mouseTimeTxt.text(new Date(Math.round(time)).toString());
      }
      
      function populateLabels(time) {
        $('.legendLabel > div > span.label-value', self.el).text('');
        _.each(self.plot.getData(), function (series) {
          if (!series.channel) return;
          var label = $('.legendLabel > div[data-channel-name="'+
              series.channel.channelName+'"] > span.label-value', self.el);
          var valueHTML;
          if (time < series.xaxis.min || time > series.xaxis.max) {
            valueHTML = '';
            return;
          }
          var hoveredPnt = _.detect(series.data, function(p, i) {
            var prev = series.data[i-1];
            return prev && p && prev[0] <= time && time < p[0] && p;
          });
          if (hoveredPnt) {
            valueHTML = '&nbsp;&nbsp;[' + self.addCommas(hoveredPnt[1]) + ']';
          } else {
            valueHTML = '[]';
          }
          label.html(valueHTML);
        });
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
          markings.push({ xaxis: { from: i, to: i + 2*24*60*60*1000 }, color: '#fcfcfc' });
          i += 7 * 24 * 60 * 60 * 1000;
        } while (i < axes.xaxis.max);
        return markings;
      }
    },

    draw: function () {
      var self = this;
      if (!self.plot) {
        self.firstDraw = true;
        self.createPlot();
      }
      if (self.model.get('channels').length === 0) {
        $('<div><span>Drop data channels here to display.</span></div>')
            .addClass('empty-graph').appendTo(self.content);
        self.plot.getOptions().crosshair.mode = null;
        //self.plot.triggerRedrawOverlay();
      } else {
        var emptyDiv = $('.empty-graph', self.content);
        if (emptyDiv.length > 0) {
          emptyDiv.remove();
          self.plot.getOptions().crosshair.mode = 'xy';
        }
      }
      var opts = self.plot.getOptions();
      var series = [], numSeriesLeftAxis = 0, numSeriesRightAxis = 0;
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
          label: channel.title,
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
      if (!self.options.forceTimeRange && self.firstDraw) {
        var mins = [], maxes = [];
        _.each(self.model.get('channels'), function (channel) {
          var data = self.model.get('data')[channel.channelName] || [];
          var times = [];
          _.each(data, function (pnt) {
            if (pnt) times.push(pnt[0]);
          });
          mins.push(_.min(times));
          maxes.push(_.max(times));
        });
        var min = _.min(mins);
        var max = _.max(maxes);
        if (min && max
            && min !== Infinity && max !== Infinity
            && min !== -Infinity && max !== -Infinity) {
          _.each(self.plot.getXAxes(), function (axis) {
            axis.options.min = min;
            axis.options.max = max;
          });
          self.firstDraw = false;
        }
      }
      self.plot.setData(series);
      self.plot.setupGrid();
      self.plot.draw();
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
        if (!(isFinite(min) && isFinite(max))) {
          min = 0; max = 1;
        } else if (min == max) {
          min -= 0.5; max += 0.5;
        }
        series.yaxis.datamax = max;
        series.yaxis.datamin = min;
      });
    },

    plotDrawHook: function() {
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
      // TODO: do we need to do this on every plot draw?
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

    removeChannel: function (e) {
      var channel = JSON.parse($(e.target).parent().attr('data-channel'));
      this.trigger('ChannelUnrequested', channel);
    },

    addGraphFromParent: function (e) {
      this.trigger('addGraph');
    },

    removeGraphFromParent: function (e) {
      this.trigger('removeGraph');
    },

  });
});

