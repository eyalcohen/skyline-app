/*
 * Graph view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'models/graph',
  'text!../../templates/graph.html',
  'flot_plugins'
], function ($, _, Backbone, mps, util, units, Graph, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'graph',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;

      // Shell events:
      this.on('rendered', this.setup, this);
      this.parentView.model.bind('change:highlightedChannel',
          _.bind(this.highlightedChannelChanged, this));

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('chart/zoom', _.bind(this.zoom, this)),
      ];
    },

    // Draw template.
    render: function () {

      // Init a model for this view.
      this.model = new Graph(this.app, this);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.graphs');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      
    },

    // Misc. setup.
    setup: function () {

      // Save refs
      this.plot = null;
      this.mouseTime = this.parentView.$('.mouse-time');
      this.mouseTimeTxt = $('span', this.mouseTime);
      this.minHoverDistance = 10;

      // Draw the canvas.
      this.draw();

      // Do resize on window change.
      this.$el.hide();
      _.delay(_.bind(function () {
        this.resize();
        this.$el.show();
      }, this), 250);
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      $(window).resize(_.debounce(_.bind(this.resize, this), 150));
      $(window).resize(_.debounce(_.bind(this.resize, this), 300));

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.plot.getPlaceholder().remove();
      this.plot = null;
      this.remove();
    },

    resize: function (e, w, h) {
      if (this.plot) {
        var width = w || this.$el.parent().width();
        var height = h || this.$el.parent().height();
        height = Math.max(height, 300);
        this.plot.setCanvasDimensions(width, height);
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    zoom: function (range) {
      if (!range) return;
      range *= 1e3;
      var xaxis = this.plot.getXAxes()[0];
      var avg = (xaxis.options.max + xaxis.options.min) / 2;
      xaxis.options.min = avg - range / 2;
      xaxis.options.max = avg + range / 2;
      this.plot.setupGrid();
      this.plot.draw();
      this.plot.getPlaceholder().trigger('plotzoom', [this.plot]);
    },

    createPlot: function () {
      var self = this;
      self.plot = $.plot(self.$el, [], {
        xaxis: {
          mode: 'time',
          utc: true,
          twelveHourClock: true,
          position: 'bottom',
          min: self.model.get('visibleTime').beg / 1e3,
          max: self.model.get('visibleTime').end / 1e3,
          tickColor: 'rgba(0,0,0,0.1)',
          tickFormatter: function (val, axis) {
            var visible = self.getVisibleTime();
            var span = (visible.end - visible.beg) / 1e3;
            var date = new Date(val);
            return span < 86400000 ?
              util.toLocaleString(date, 'h:MM:ss TT') :
              util.toLocaleString(date, 'm/d/yy');
          }
        },
        yaxis: {
          reserveSpace: true,
          labelWidth: 0,
          zoomRange: false,
          panRange: false,
          tickColor: 'rgba(0,0,0,0.05)',
          labelsInside: true,
        },
        yaxes: [
          { position: 'right' },
          { position: 'left', alignTicksWithAxis: 1 },
        ],
        series: {
          lines: {
            lineWidth: 2
          },
          points: {
            show: true,
            radius: 3,
            lineWidth: 1,
            symbol: 'circle'
          },
          bars: {},
          shadowSize: 1
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
        zoom: {
          interactive: false,
        },
        pan: {
          interactive: true,
          frameRate: 60,
          useShiftKey: true,
        },
        legend: {
          margin: [40, 0],
          oneperyaxis: true,
          labelFormatter: labelFormatter,
        },
        hooks: {
          draw: [_.bind(self.plotDrawHook, self)],
          setupGrid: [_.bind(self.plotSetupGridHook, self)],
          bindEvents: [bindEventsHook],
        },
        padding: {x: 0, y: 20}
      });

      function labelFormatter(label, series) {
        var channels = self.model.getChannels();
        var channel = channels[series.channelIndex];
        if (!channel) return;
        var r = "<div class='label-wrap' " +
            "data-graph-id='" + self.model.id + "'" +
            "data-channel-index='" + series.channelIndex + "' " +
            "data-channel-name='" + _.escape(channel.channelName) + "'>";
        r += '<span class="jstree-draggable" style="cursor:pointer">';
        r += _.str.strLeft(channel.humanName, '__') || channel.shortName;
        r += '</span>';
        if (channel.units) {
          var compat = units.findCompatibleUnits(
              channel.displayUnits || channel.units);
          if (compat) {
            r += ' (<select>';
            compat.units.forEach(function (u) {
              if (u === compat.selected)
                r += '<option selected>';
              else
                r += '<option>';
              r += _.escape(u.unit);
              /*
              if (u.long)
                r += ' (' + _.escape(u.long) + ')';
              */
              r += '</option>';
            });
            r += '</select>)';
          } else {
            r += ' (' + _.escape(channel.units) + ')';
          }
        }
        r += '</div>';
        return r;
      }

      function bindEventsHook(plot, eventHolder) {
        plot.getPlaceholder().mousemove(function (e) {
          var mouse = self.getMouse(e, plot);
          var xaxis = plot.getXAxes()[0];
          var time = xaxis.c2p(mouse.x);
          self.mouseHoverTime(time * 1e3, mouse, self);
        })
        .bind('mouseleave', function (e) {
          self.mouseHoverTime(null);
        })
        .mousewheel(function (e) {
          if (self.noteBox) return;
          var delta = e.originalEvent.wheelDelta || -e.originalEvent.detail;
          graphZoomClick(e, e.shiftKey ? 1.5 : 1.1, delta < 0);
          return false;
        })
        .dblclick(function (e) {
          if (self.noteBox) return;
          graphZoomClick(e, e.shiftKey ? 8 : 2, e.altKey || e.metaKey);
        });

        function graphZoomClick(e, factor, out) {
          var c = plot.offset();
          c.left = e.originalEvent.pageX - c.left;
          c.top = e.originalEvent.pageY - c.top;
          if (out)
            plot.zoomOut({center: c, amount: factor});
          else
            plot.zoom({center: c, amount: factor});
        }
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
            color: 'rgba(249, 249, 249, 0.8)',
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

      var emptyDiv = $('.empty-graph', self.content);
      var channels = [];
      _.each(self.model.getChannels(), function (c) {
        channels.push($.extend(true, {}, c));
      });

      if (channels.length === 0 && emptyDiv.length === 0) {
        $('<div class="empty-graph"><div><span>'
            + 'Drop data channels here to display.</span></div></div>')
            .appendTo(self.content);
      } else if (channels.length > 0 && emptyDiv.length > 0) {
        emptyDiv.remove();
        self.resize(null, true);
      }

      if (channels.length === 0) {
        channels.push({ channelName: 'empty' });
        _.each(self.plot.getYAxes(),
              function (a) { a.options.show = false; });
      } else {
        _.each(self.plot.getYAxes(),
              function (a) { a.options.show = null; });
      }

      var opts = self.plot.getOptions();
      var series = [];
      _.each(channels, function (channel, i) {
        var highlighted = self.highlightedChannel === channel.channelName;
        var seriesBase = {
          xaxis: 1,
          yaxis: channel.yaxisNum,
          channelIndex: i,
          channelName: channel.channelName,
        };
        var data = self.calculateSeriesData(channel);
        series.push(_.extend({
          lines: {
            show: true,
            lineWidth: 2,
            fill: false,
          },
          data: data.data,
          label: channel.title,
        }, seriesBase));
        if (data.minMax.length > 0) {
          series.push(_.extend({
            lines: {
              show: true,
              lineWidth: 0,
              fill: 0.6,
            },
            data: data.minMax,
          }, seriesBase));
        }
      });
      self.updateSeriesColors(series);
      self.plot.setData(series);
      self.plot.setupGrid();
      self.plot.draw();
    },

    calculateSeriesData: function (channel) {
      var conv = units.findConversion(channel.units,
          channel.displayUnits || channel.units);
      var samples = this.model.sampleSet[channel.channelName] || [];
      var data = [];
      var minMax = [];
      var prevEnd = null, prevMinMaxEnd = null;
      _.each(samples, function (s, i) {
        if (prevEnd != s.beg)
          data.push(null);
        var val = s.val * conv.factor + conv.offset;
        data.push([s.beg / 1000, val]);
        // if (s.end !== s.beg)
        //   data.push([s.end / 1000, val]);
        prevEnd = s.end;
        if (s.min != null || s.max != null) {
          if (prevMinMaxEnd != s.beg)
            minMax.push(null);
          var max = s.max == null ? val : s.max * conv.factor + conv.offset;
          var min = s.min == null ? val : s.min * conv.factor + conv.offset;
          minMax.push([s.beg / 1000, max, min]);
          if (s.end !== s.beg)
            minMax.push([s.end / 1000, max, min]);
          prevMinMaxEnd = s.end;
        }
      });
      return { data: data, minMax: minMax };
    },

    updateSeriesColors: function (series) {
      var self = this;
      var channels = self.model.getChannels();
      if (channels.length === 0) return;
      var yAxes = self.plot.getYAxes();
      series.forEach(function (s, i) {
        var channel = channels[s.channelIndex];
        var highlighted = self.highlightedChannel === channel.channelName;
        var color = self.app.colors[channel.colorNum];
        s.originalColor = color;
        if (self.highlightedChannel && !highlighted) {
          // Lighten color.
          color = $.color.parse(color);
          color.r = Math.round((color.r + 255*2) / 3);
          color.g = Math.round((color.g + 255*2) / 3);
          color.b = Math.round((color.b + 255*2) / 3);
          color = color.toString();
        }
        s.color = color;
        if (s.lines.fill)
          s.zorder = highlighted ? 50000 : s.channelIndex;
        else
          s.zorder = 10000 + (highlighted ? 50000 : s.channelIndex);
        if (i < yAxes.length) {
          yAxes[i].options.color = color;
        }
      });
    },

    plotSetupGridHook: function () {
      if (!this.plot) return;
      var xopts = this.plot.getAxes().xaxis.options;
      var xmin = xopts.min, xmax = xopts.max;
      var yAxes = this.plot.getYAxes();
      
      // Automatically change Y-axis bounds based on visible data.
      yAxes.forEach(function (axis) {
        axis.datamin = Infinity;
        axis.datamax = -Infinity;
      });
      
      // TODO: this is ugly, and probably slow.
      this.plot.getData().forEach(function (series) {
        var max = series.yaxis.datamax, min = series.yaxis.datamin;
        var prevTime = null;
        series.data.forEach(function (p) {
          if (p && prevTime && p[0] >= xmin && prevTime <= xmax) {
            max = Math.max(max, p[1]);
            min = Math.min(min, p[2] == null ? p[1] : p[2]);
          }
          prevTime = p && p[0];
        });
        series.yaxis.datamax = max;
        series.yaxis.datamin = min;
      });
      yAxes.forEach(function (axis) {
        if (!(isFinite(axis.datamin) && isFinite(axis.datamax))) {
          axis.datamin = 0; axis.datamax = 1;
        } else if (axis.datamin == axis.datamax) {
          axis.datamin -= 0.5; axis.datamax += 0.5;
        }
      });
    },

    plotDrawHook: function () {
      var t = this.getVisibleTime();
      if (!t) return;
      if (t.beg != this.prevBeg || t.end != this.prevEnd) {
        this.trigger('VisibleTimeChange', {beg: t.beg, end: t.end});
        this.prevBeg = t.beg;
        this.prevEnd = t.end;
      }
      if (t.width != this.prevWidth) {
        this.trigger('VisibleWidthChange', t.width);
        this.prevWidth = t.width;
      }
    },

    getVisibleTime: function () {
      if (!this.plot) return null;
      var xopts = this.plot.getAxes().xaxis.options;
      return { beg: xopts.min * 1000, end: xopts.max * 1000,
               width: this.plot.width() };
    },

    setVisibleTime: function (beg, end) {
      var xopts = this.plot.getAxes().xaxis.options;
      beg /= 1000; end /= 1000;
      if (beg != xopts.min || end != xopts.max) {
        xopts.min = beg;
        xopts.max = end;
        this.plot.setupGrid();
        this.plot.draw();
      }
    },

    mouseHoverTime: function (time, mouse, graph) {
      var self = this;
      if (time != null) time = time / 1e3;
      // if (time != null) {
      //   self.mouseTime.show();
      //   // TODO: finer than 1 second granularity.
      //   var date = new Date(Math.round(time));
      //   self.mouseTimeTxt.text(util.toLocaleString(date,
      //       'dddd m/d/yy h:MM:ss TT Z'));
      // } else {
      //   self.mouseTime.hide();
      // }
      if (time == null && self.highlightedChannel)
          self.parentView.model.set({ highlightedChannel: null });

      var newHightlightedChannel = null;
      var minDist = Infinity;
      _.each(self.plot.getData(), function (series) {
        if (!series.channelName || series.lines.fill) return;
        var labelSibling = $('.legendLabel > div[data-channel-name="'+
            series.channelName+'"]', self.el);
        var labelParent = labelSibling.parent().parent();
        var label = $('.legendValue', labelParent);
        var valueHTML = '';
        if (time != null &&
            time >= series.xaxis.datamin && time <= series.xaxis.datamax) {
          var hp = _.detect(series.data, function (p, i) {
            var prev = series.data[i-1];
            return prev && p && prev[0] <= time && time < p[0] && p;
          });
          if (hp) {
            if (graph === self && mouse) {
              
              // Check for mouse near vertical lines
              // as well as horizontal lines.
              var dx = Infinity, dy = Infinity;
              var i = series.data.indexOf(hp);
              var hpxc = series.xaxis.p2c(hp[0]);
              var hpyc = series.yaxis.p2c(hp[1]);
              if (series.data.length > 1 &&
                  i > 0 && i < series.data.length - 2) {
                var hpl = series.data[i - 1];
                var hpr = series.data[i + 1];
                if (hpr) {
                  var hplxc = series.xaxis.p2c(hpl[0]);
                  var hplyc = series.yaxis.p2c(hpl[1]);
                  var hpryc = series.yaxis.p2c(hpr[1]);
                  var dxl = mouse.x - hplxc;
                  var dxr = hpxc - mouse.x;
                  if ((mouse.y > hpyc && mouse.y < hpryc) ||
                      (mouse.y > hpryc && mouse.y < hpyc)) {
                    dx = dxr;
                  } else if (i > 2) {
                    var hpll = series.data[i - 2];
                    if (hpll) {
                      var hpllyc = series.yaxis.p2c(hpll[1]);                  
                      var goingUp = hp[1] < hpr[1];
                      if ((goingUp && mouse.y > hplyc &&
                          mouse.y < hpllyc) ||
                          (!goingUp && mouse.y < hplyc &&
                          mouse.y > hpllyc)) {
                        dx = dxl;
                      }
                    }
                  }
                }
              }
              dy = Math.abs(hpyc - mouse.y);
              var d = Math.min(dx, dy);
              if (d <= minDist && d <= self.minHoverDistance) {
                minDist = d;
                newHightlightedChannel = series.channelName;
              }
            }
            var v = hp[1];
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
            valueHTML = util.addCommas(v);
          }
        }
        label.html(valueHTML);
      });
      if (mouse && graph === self) {
        self.parentView.model.set({highlightedChannel: newHightlightedChannel});
        self.plot.getPlaceholder().css(
            {cursor: newHightlightedChannel ? 'pointer' : 'default'});
      }
    },

    highlightedChannelChanged: function (model, highlightedChannel) {
      if (highlightedChannel != this.highlightedChannel) {
        if (this.highlightedLabel)
          this.highlightedLabel.removeClass('label-highlight');
        this.highlightedChannel = highlightedChannel;
        if (highlightedChannel) {
          var labelSibling = $('.legendLabel > div[data-channel-name="'+
              highlightedChannel+'"]', this.el);
          this.highlightedLabel = labelSibling.parent().parent();
          this.highlightedLabel.addClass('label-highlight');
        } else
          this.highlightedLabel = null;
        this.updateSeriesColors(this.plot.getData());
        this.plot.draw();
      }
    },

    unitsChange: function (e) {
      var newUnits = e.target.value;
      var channelName = $(e.target.parentNode).attr('data-channel-name');
      var channels = this.model.getChannels();
      var series = this.plot.getData();
      for (var i = 0; i < series.length; ++i) {
        if (series[i].channelName === channelName) {
          var channel = channels[series[i].channelIndex];
          channel.displayUnits = newUnits;
          var data = this.calculateSeriesData(channel);
          series[i].data = data.data;
          if (series[i+1] &&
              series[i+1].channelName === channelName &&
              data.minMax.length > 0) {
            series[i+1].data = data.minMax;
          }
          break;
        }
      }
      this.plot.setData(series);
      this.plot.setupGrid();
      this.plot.draw();
    },

    getMouse: function (e, plot) {
      return {
        x: e.pageX - parseInt(plot.offset().left),
        y: e.pageY - parseInt(plot.offset().top),
      };
    },

  });
});

