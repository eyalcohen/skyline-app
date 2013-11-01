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
      // 'click .graph-channels li': 'channelClick',
    },

    // Misc. setup.
    setup: function () {

      // Save refs
      this.plot = null;
      this.mouseTime = this.parentView.$('.mouse-time');
      this.mouseTimeTxt = $('span', this.mouseTime);
      // this.eventPreview = this.$('.event-preview');
      // this.eventIcons = [];
      this.minHoverDistance = 10;
      // this.following = false;
      // this.noteBox = null;
      // this.noteWindow = null;
      // this.editingNote = false;

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

    // addChannelToPanel: function (channel) {
    //   var li = $('<li>' + channel.val.channelName + '</li>');
    //   li.data('channel', channel);
    //   li.appendTo(this.panel);
    // },

    // channelClick: function (e) {
    //   var li = $(e.target);
    //   if (li.hasClass('active')) {
    //     li.removeClass('active');
    //     this.model.removeChannel(li.data('channel').val);
    //   } else {
    //     li.addClass('active');
    //     this.model.addChannel(li.data('channel').val);
    //   }
    // },

    /////////////////////////////////// OLD

    // initialize: function (app) {
    //   this._super('initialize', args);
    //   _.bindAll(this, 'destroy', 'highlightedChannelChanged',
    //             'showEvent', 'hideEvent',
    //             'mouseHoverTime', 'addYaxesBoundsForDrops',
    //             'removeYaxesBoundsForDrops', 'ensureLegend', 'openNote');
    //   var tabId = args.tabId;
    //   var id = args.id;
    //   this.model.tabModel.bind('change:highlightedChannel',
    //                            this.highlightedChannelChanged);
    //   App.subscribe('PreviewEvent-' + tabId, this.showEvent);
    //   App.subscribe('UnPreviewEvent-' + tabId, this.hideEvent);
    //   App.subscribe('OpenNote-' + tabId, this.openNote);
    //   App.subscribe('MouseHoverTime-' + tabId, this.mouseHoverTime);
    //   App.subscribe('DragStart-' + tabId, this.addYaxesBoundsForDrops);
    //   App.subscribe('DragEnd-' + tabId, this.removeYaxesBoundsForDrops);
    //   This is a horribly crufty way to avoid drawing the legends every time
    //   the plot is redrawn but also ensure that it gets redawn when channels
    //   are dropped in.
    //   this.ensureLegendRedraw = true;
    //   App.subscribe('ChannelDropped-' + id, this.ensureLegend);
    // },

    // events: {
    //   'click .toggler': 'toggle',
    //   'click .fetchLatest': 'fetchLatest',
    //   'click .followLatest': 'followLatest',
    //   'click .export': 'exportCsv',
    //   'click .add-graph': 'addGraph',
    //   'click .graph-closer': 'removeGraph',
    // },

    // render: function (opts, fn) {
    //   opts = opts || {};
    //   _.defaults(opts, {
    //     title: this.options.title,
    //     waiting: false,
    //     loading: false,
    //     empty: false,
    //     shrinkable: false,
    //   });
    //   // if (this.el.length) this.remove();
    //   this.plot = null;
    //   // this.el = App.engine('graph.dash.jade', opts)
    //   //     .appendTo(this.options.parent);
    //   this.mouseTime = $('.mouse-time', this.el);
    //   this.mouseTimeTxt = $('span', this.mouseTime);
    //   this.eventPreview = $('.event-preview', this.el);
    //   this.eventIcons = [];
    //   this.minHoverDistance = 10;
    //   this.following = false;
    //   this.noteBox = null;
    //   this.noteWindow = null;
    //   this.editingNote = false;
    //   // this._super('render');
    //   this.draw();
    // },

    resize: function (e, w, h) {
      if (this.plot) {
        var width = w || this.$el.parent().width();
        var height = h || this.$el.parent().height();
        height = Math.max(height, 300);
        this.plot.setCanvasDimensions(width, height);
        // this.noteCanvas.attr({width: width, height: height});
        // this.redrawNote();
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
        crosshair: { /*mode: 'x'*/ },
        zoom: {
          interactive: false, // We implement zooming event handlers ourselves.
        },
        pan: {
          interactive: true,
          frameRate: 60,
          useShiftKey: true,
          // onShiftDragStart: _.bind(self.beginNote, self),
          // onShiftDrag: _.throttle(_.bind(self.drawNote, self), 20),
          // onShiftDragEnd: _.bind(self.endNote, self),
          // cancelShiftDrag: _.bind(self.cancelNote, self),
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

      // self.plot.lockCrosshair(); // Disable default crosshair movement.
      // $('.graph', self.content).data({
        // plot: self.plot,
        // id: self.options.id,
      // });

      // self.noteCanvas =
      //     $('<canvas width="' + self.plot.getPlaceholder().width() +
      //       '" height="' + self.plot.getPlaceholder().height() +
      //       '" class="note-canvas">').
      //     appendTo(self.$el);
      // self.noteCtx = self.noteCanvas.get(0).getContext('2d');

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
          // If we're hovering over the legend, don't do data mouseover.
          if (inLegend(e.target))
            mouse = null;
          // App.publish('MouseHoverTime-' + self.model.get('tabId'),
          //             [time * 1e3, mouse, self]);
          self.mouseHoverTime(time * 1e3, mouse, self);
        })
        .bind('mouseleave', function (e) {
          // App.publish('MouseHoverTime-' + self.model.get('tabId'), [null]);
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
      
      if (this.prevNumChannels !== this.model.getChannels().length
          || this.ensureLegendRedraw) {
        this.setupLegend();
        this.prevNumChannels = this.model.getChannels().length;
      } else {
        this.setupLegend();
      }
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
      this.positionIcons();
    },

    setupIcons: function () {
      var self = this;
      if (self.eventIcons.length > 0)
        self.eventIcons.remove();
      var events =
          _.stableSort(_.pluck(self.model.get('events'), 'attributes'),
          function (s1, s2) {
        return (s2.end - s2.beg) - (s1.end - s1.beg);
      });
      _.each(events, function (not) {
        var icon = $('<img ' + (not.type === '_note' && self.id === 'MASTER' ?
                    'id="' + not.id + '"' : '') + '>')
            .attr({ src: not.meta.icon })
            .css({ bottom: 20 })
            .addClass('timeline-icon')
            .data(_.extend({}, not))
            .appendTo(self.$el)
            .bind('mousedown mouseup mousemove DOMMouseScroll mousewheel',
                function (e) {
              if (e.type === 'mousedown' || 
                  e.type === 'mousemove')
                $('.flot-overlay', self.content).trigger(e);
              else
                if (e.type === 'mouseup')
                  self.plot.getPlaceholder().css({ cursor: 'default' });
              else
                self.plot.getPlaceholder().trigger(e, e.wheelDelta || -e.detail);
            })
            .bind('click', function (e) {
              var not = $(e.target).data();
              if (not.type !== '_note') return;
              if ($('.note').length > 0) {
                _.each(self.model.tabModel.graphModels, function (gm) {
                  if (gm.view.noteWindow)
                      gm.view.cancelNote();
                });
              }
              var xaxis = self.plot.getXAxes()[0];
              var off = _.map(self.plot.offset(), function (o) {
                return parseInt(o);
              });
              var dsEvent = $.Event('dragstart');
              var dEvent = $.Event('drag');
              var deEvent = $.Event('dragend');
              _([dsEvent, dEvent, deEvent]).each(function (evt) {
                evt.which = 1;
                evt.shiftKey = true;
                evt.pageY = off[0] + 30;
                evt.note = not;
              });
              dsEvent.pageX = xaxis.p2c(not.beg / 1e3) + off[1];
              dEvent.pageX = xaxis.p2c(not.end / 1e3) + off[1];
              deEvent.pageX = xaxis.p2c(not.end / 1e3) + off[1];
              $('.flot-overlay', self.$el)
                  .trigger(dsEvent)
                  .trigger(dEvent)
                  .trigger(deEvent);
            })
            .bind('mouseover', function (e) {
              // App.publish('PreviewEvent-' + self.model.get('tabId'),
              //             [{beg: not.beg, end: not.end}]);
            })
            .bind('mouseout', function (e) {
              // App.publish('UnPreviewEvent-' + self.model.get('tabId'));
            });
            // .bind('mouseout', function (e) {
            //   var not = $(e.target).data();
            //   if (not.type !== '_note') return;
            //   (function checkItBoy() {
            //     _.delay(function () {
            //       if (!self.editingNote)
            //         self.cancelNote(null, self.plot);
            //       else checkItBoy();
            //     }, 250);
            //   })();
            // });
      });
      self.eventIcons = this.$('.timeline-icon');
      self.positionIcons();
    },

    positionIcons: function () {
      var self = this;
      var xaxis = this.plot.getXAxes()[0];
      _.each(this.eventIcons, function (icon, i) {
        var $icon = $(icon);
        var left = xaxis.p2c($icon.data('beg') / 1e3) - 8;
        if (left >= 0 && left <= self.$el.width()) {
          $icon.css({
            left: xaxis.p2c($icon.data('beg') / 1e3) - 8,
          });
          $icon.show();
        } else $icon.hide();
      });
    },

    setupLegend: function () {
      this.plot.setupLegend(_.bind(function (okay) {
        if (okay)
          this.ensureLegendRedraw = false;
      }, this));
      this.$('.label-closer').click(_.bind(function (e) {
        var labelParent = $(e.target).parent().parent();
        var label = $('.legendLabel > div', labelParent);
        $('li#' + label.data('channel-name')).click();
        // var datasetId = Number(_.str.strRight(label.data('channel-name'), '__'));
        // this.model.removeChannel(datasetId, label.data('channel-name'));
      }, this));
      this.$('.legend tr')
          .bind('mouseenter', _.bind(this.enterLegend, this))
          .bind('mouseleave', _.bind(this.leaveLegend, this));
      this.$('.legend select')
          .bind('change', _.bind(this.unitsChange, this));
      // add note channels from legend
      // this.$('.legendLabel').bind('click',
      //     _.bind(this.addNoteChannelFromLabel, this));
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
      if (time != null)
        time = time / 1e3;
      if (time == null)
        self.plot.clearCrosshair();
      else
        self.plot.setCrosshair({x: time});
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

    addYaxesBoundsForDrops: function () {
      var self = this;
      if (this.axisTargets) return;
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
              id: self.options.id,
              dragover: function () { $(this).css({ opacity: 1 }) },
              dragout: function () { $(this).css({ opacity: 0 }) },
            })
            .css({
              left: (axis.n - 1) * self.plot.width() / 2,
              top: 0,
              width: self.plot.width() / 2,
              height: box.height,
              'border-left': borderLeft,
              'border-right': borderRight,
            })
            .addClass('axisTarget')
            .addClass('jstree-drop')
            .appendTo(self.content);
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

    removeYaxesBoundsForDrops: function () {
      if (!this.axisTargets) return;
      this.axisTargets.remove();
      this.axisTargets = null;
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

    showEvent: function (range) {
      var xaxis = this.plot.getXAxes()[0];
      var leftSide = Math.max(xaxis.p2c(range.beg / 1e3), 0);
      var rightSide = Math.min(xaxis.p2c(range.end / 1e3), this.plot.width());
      if (leftSide < this.plot.width() && rightSide > 0) {
        this.eventPreview.css({
          left: leftSide + 'px',
          width: rightSide - leftSide + 'px',
        }).show();
      }
    },

    hideEvent: function () {
      this.eventPreview.hide();
    },

    // fetchLatest: function (e, cb) {
    //   if (e) e.preventDefault();
    //   var self = this;
    //   App.sampleCache.refetchLatest(self.model.tabModel.treeModel,
    //                                 self.model.get('datasetId'),
    //                                 function (newTimeRange) {
    //     //* Note: for testing only!
    //     // if (!newTimeRange) {
    //     //   newTimeRange = self.getVisibleTime();
    //     //   var rand = Math.random() * 10000000;
    //     //   newTimeRange.beg += rand;
    //     //   newTimeRange.end += rand;
    //     // }
    //     //*
    //     if (newTimeRange) {
    //       var prevTimeRange = self.getVisibleTime();
    //       var xaxis = self.plot.getXAxes()[0];
    //       pan(xaxis.p2c(newTimeRange.end / 1e3)
    //             - xaxis.p2c(prevTimeRange.end / 1e3), function () {
    //         if (cb) cb();
    //       });
    //     } else if (cb) cb();
    //   });

    //   function pan(dest, cb) {
    //     var dur = 500, inc = 20;
    //     var pos = _.map(_.range(0, dur+inc, inc),
    //         function (time) {
    //       return App.easing.easeOutExpo(time, 0, dest, dur);
    //     });
    //     var len = pos.length;
    //     var steps = _.map(pos, function (p, i) {
    //       return i < len - 1 ? pos[i+1] - p : 0;
    //     });
    //     (function step(i) {
    //       if (i < len)
    //         _.delay(function () {
    //           self.plot.pan({ left: steps[i], top: 0 });
    //           step(++i);
    //         }, inc);
    //       else cb();
    //     })(0);
    //   }
    // },

    // followLatest: function (e) {
    //   e.preventDefault();
    //   var self = this;
    //   var freq = 10000;
    //   var button = $(e.target);
    //   if (button.hasClass('small-button-sticky-active')) {
    //     button.removeClass('small-button-sticky-active');
    //     this.following = false;
    //   } else {
    //     button.addClass('small-button-sticky-active');
    //     this.following = true;
    //     checkLatest();
    //   }

    //   function checkLatest() {
    //     if (self.following) {
    //       self.fetchLatest(null, function () {
    //         if (self.following)
    //           _.delay(checkLatest, freq);
    //       });
    //     }
    //   }
    // },

    // exportCsv: function (e) {
    //   var self = this;
    //   e.preventDefault();
    //   var channels = [
    //       { channelName: '$beginDate', title: 'Begin Date' },
    //       { channelName: '$beginTime', title: 'Begin Time' },
    //       { channelName: '$beginRelTime', title: 'Begin Since Start', units: 's' },
    //       { channelName: '$endRelTime', title: 'End Since Start', units: 's' },
    //     ].concat(self.model.getChannels());
    //   App.engine('export_csv.dialog.jade',
    //       { channels: channels }).appendTo(self.el).modal({
    //     appendTo: self.el,
    //     overlayId: 'osx-overlay',
    //     containerId: 'osx-container',
    //     closeHTML: null,
    //     minHeight: 80,
    //     opacity: 65,
    //     position: ['0',],
    //     overlayClose: true,
    //     onOpen: function (d) {
    //       var self = this;
    //       self.container = d.container[0];
    //       d.overlay.fadeIn('fast', function () {
    //         $('#osx-modal-content', self.container).show();
    //         var title = $('#osx-modal-title', self.container);
    //         title.show();
    //         d.container.slideDown('fast', function () {
    //           setTimeout(function () {
    //             var h = $('#osx-modal-data', self.container).height() +
    //                 title.height() + 20;
    //             d.container.animate({ height: h }, 200, function () {
    //               $('div.close', self.container).show();
    //               $('#osx-modal-data', self.container).show();
    //             });
    //           }, 300);
    //         });
    //       });
    //     },
    //     onClose: function (d) {
    //       var self = this;
    //       d.container.animate({ top:'-' + (d.container.height() + 20) }, 300,
    //           function () {
    //         self.close();
    //         $('#osx-modal-content').remove();
    //       });
    //     },
    //   });
    //   $('[value="noResample"]').attr('checked', true);
    //   $('[name="minmax"]').attr('disabled', true);
    //   $('[name="sampleType"]').click(onSampleTypeClick);
    //   function onSampleTypeClick(e) {
    //     $('[name="minmax"]').get(0).disabled =
    //         $('[value="noResample"]').is(':checked');
    //     checkExportOk();
    //   }
    //   function checkExportOk() {
    //     var resampling = $('[value="resample"]').is(':checked');
    //     var viewRange = self.getVisibleTime();
    //     var resampleTime = Math.round(Number($('#resample').val()) * 1e6);
    //     var exportCount =
    //         Math.ceil((viewRange.end - viewRange.beg) / resampleTime);
    //     var maxCount = 100000;
    //     if (resampling && !(exportCount <= maxCount)) {
    //       $('#rowCount').text(self.addCommas(exportCount));
    //       $('#rowMax').text(self.addCommas(maxCount));
    //       $('#exportError').css('visibility', 'visible');
    //       $('#download-data').addClass('disabled');
    //       return false;
    //     } else {
    //       $('#exportError').css('visibility', 'hidden');
    //       $('#download-data').removeClass('disabled');
    //       return true;
    //     }
    //   }
    //   $('#resample').focus(onResampleTextClick).click(onResampleTextClick).
    //       keyup(checkExportOk).change(checkExportOk);
    //   function onResampleTextClick(e) {
    //     $('[value="resample"]').click();
    //     onSampleTypeClick();
    //   }
    //   $('#download-data').click(function (e) {
    //     if (!checkExportOk()) return;
    //     var viewRange = self.getVisibleTime();
    //     var resample = !$('[value="noResample"]').is(':checked');
    //     var minmax = $('[name="minmax"]').is(':checked');
    //     var resampleTime = $('#resample').val();
    //     // TODO: calculate how many data points we'll generate with a resample,
    //     // and give some kind of warning or something if it's ridiculous.
    //     // TODO: maybe use the new download attribute on an anchor element?
    //     // http://html5-demos.appspot.com/static/a.download.html
    //     // We should really fetch the data via dnode then force the download
    //     // client-side... this way we can show a loading icon while the
    //     // user waits for the server to package everything up.
    //     var href = '/export/' +
    //         self.model.get('datasetId') + '/data.csv' +
    //         '?beg=' + Math.floor(viewRange.beg) +
    //         '&end=' + Math.ceil(viewRange.end) +
    //         (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
    //         (resample && minmax ? '&minmax' : '') +
    //         channels.map(function (c){return '&chan=' + c.channelName}).join('');
    //     window.location.href = href;
    //   });
    //   return self;
    // },

    enterLegend: function (e) {
      var row = $(e.target).closest('tr');
      var channelName = $('[data-channel-name]', row).attr('data-channel-name');
      this.parentView.model.set({highlightedChannel: channelName});
    },

    leaveLegend: function (e) {
      var receiver = document.elementFromPoint(e.clientX, e.clientY);
      if (!receiver) return;
      if (receiver.nodeType == 3) // Opera
        receiver = receiver.parentNode;
      if ($('[data-channel-name]', $(receiver).closest('tr')).length > 0)
        return;
      this.parentView.model.set({highlightedChannel: null});
    },

    ensureLegend: function () {
      this.ensureLegendRedraw = true;
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
          // App.stateMonitor.updateOpts(this.options.tabId, this.options.id, channel);
          var data = this.calculateSeriesData(channel);
          series[i].data = data.data;
          // HACK
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

    // removeChannel: function (e) {
    //   var self = this;
    //   var labelParent = $(e.target).parent().parent();
    //   var label = $('.legendLabel > div', labelParent);
    //   var channelIndex = Number(label.attr('data-channel-index'));
    //   var channel = self.model.getChannels()[channelIndex];
    //   // App.publish('ChannelUnrequested-' + 
    //   //     self.options.tabId + '-' + self.options.id, [channel]);
    //   // Update note channel list visible.
    //   _.delay(function () {
    //     var channelNames = self.model.get('tabModel').getAllChannelNames();
    //     $('.note-channel-link', self.model.get('tabModel').view.el).each(function () {
    //       var ncn = $(this).text();
    //       if (_.find(channelNames, function (cn) {
    //         return cn === ncn;
    //       }))
    //         $(this.nextElementSibling).show();
    //       else
    //         $(this.nextElementSibling).hide();
    //     });
    //   }, 100);
    // },

    // addGraph: function (e) {
    //   var self = this;
    //   App.publish('GraphRequested-' + this.options.tabId,
    //               [App.util.makeId(), null, function () {
    //     var otherGraphs = self.model.tabModel.graphModels;
    //     _.each(otherGraphs, function (gm) {
    //       if (gm.view.id !== self.id) {
    //         if (self.noteBox) {
    //           gm.view.noteCanvas.show();
    //           gm.view.noteBox = self.noteBox;
    //           gm.view.redrawNote();
    //         }
    //       }
    //     });
    //   }]);
    // },

    // removeGraph: function (e) {
    //   var self = this;
    //   var channels = [];
    //   _.each(self.model.getChannels(), function (channel) {
    //     channels.push($.extend(true, {}, channel));
    //   });
    //   _.each(channels, function (channel) {
    //     App.publish('ChannelUnrequested-' +
    //                 self.options.tabId + '-' + self.options.id, [channel]);
    //   });
    //   if (this.noteWindow)
    //     this.cancelNote();
    //   if (self.options.id !== 'MASTER')
    //     App.publish('GraphUnrequested-' +
    //                 self.options.tabId, [self.options.id]);
    //   else if (self.model.tabModel.graphModels.length > 1) {
    //     var donor = self.model.tabModel.graphModels[1];
    //     var donorChannels = [];
    //     _.each(donor.get('channels'), function (channel) {
    //       donorChannels.push($.extend(true, {}, channel));
    //     });
    //     _.each(donorChannels, function (channel) {
    //       App.publish('ChannelRequested-' +
    //                 self.options.tabId + '-' + self.options.id, [channel]);
    //       App.publish('ChannelUnrequested-' +
    //                   donor.get('tabId') + '-' + donor.get('id'), [channel]);
    //     });
    //     App.publish('GraphUnrequested-' +
    //                 donor.get('tabId'), [donor.get('id')]);
    //   }
    // },

    getMouse: function (e, plot) {
      return {
        x: e.pageX - parseInt(plot.offset().left),
        y: e.pageY - parseInt(plot.offset().top),
      };
    },

    // Note handling.

    // beginNote: function (e, plot) {
    //   return;
    //   this.noteCanvas.show();
    //   if (this.noteBox) this.clearNoteBox();
    //   this.noteBox = {
    //     x: this.getMouse(e, this.plot).x,
    //     y: 0,
    //     w: 0,
    //     h: this.plot.getPlaceholder().height(),
    //   };
    // },

    // drawNote: function (e, plot, neighbor) {
    //   return;
    //   var self = this;
    //   self.noteCtx.fillStyle = 'rgba(255,255,0,0.2)';
    //   self.clearNoteBox();
    //   self.noteBox.w = neighbor ? -neighbor.noteBox.w :
    //       self.getMouse(e, self.plot).x - self.noteBox.x;

    //   self.noteCtx.fillRect(self.noteBox.x, self.noteBox.y,
    //                         self.noteBox.w, self.noteBox.h);
    //   if (neighbor) return;
    //   var otherGraphs = self.model.tabModel.graphModels;
    //   _.each(otherGraphs, function (gm) {
    //     if (gm.view.id !== self.id) {
    //       gm.view.beginNote(e);
    //       gm.view.drawNote(e, null, self);
    //     }
    //   });
    // },

    // endNote: function (e, plot) {
    //   return;
    //   var self = this;
    //   if (self.noteWindow)
    //     self.clearNoteWindow();
    //   var mouse = self.getMouse(e, plot);
    //   var xaxis = plot.getXAxes()[0];
    //   var onRight, leftEdge, rightEdge;
    //   if (mouse.x < self.noteBox.x) {
    //     onRight = $(document).width() - 320 > e.pageX - self.noteBox.w;
    //     leftEdge = mouse.x;
    //     rightEdge = self.noteBox.x;
    //   } else {
    //     onRight = $(document).width() - 320 > e.pageX;
    //     leftEdge = self.noteBox.x;
    //     rightEdge = mouse.x;
    //   }

    //   var isNew = !e.note;
    //   var note = e.note ? e.note : {
    //     beg: xaxis.c2p(leftEdge) * 1e3,
    //     end: xaxis.c2p(rightEdge) * 1e3,
    //     val: {
    //       userId: App.user._id,
    //       channels: _.pluck(self.getAllChannels(), 'channelName'),
    //     },
    //   };

    //   self.noteChannels = note.val.channels;

    //   self.noteWindow = self.getNote({
    //     isNew: isNew,
    //     onRight: onRight,
    //     top: mouse.y + 3,
    //     left: onRight ? rightEdge + 15 : leftEdge - 315,
    //   }, note).hide().appendTo(self.el).fadeIn(200);

    //   self.fitNote(mouse.y + 3);

    //   $('.note-content').scrollTo('max', 500, {
    //                               easing: App.easing.easeOutExpo });

    //   var body = $('.note-text', self.noteWindow);
    //   var msg = $('.note-message', self.noteWindow);
    //   var loading = $('.note-loading', self.noteWindow);
    //   var spinner = new Spinner({
    //     lines: 8,
    //     length: 0,
    //     width: 2,
    //     radius: 8,
    //     color: 'yellow',
    //     speed: 1,
    //     trail: 60,
    //     shadow: false,
    //   });
    //   spinner.spin(loading.get(0));

    //   // for visibility
    //   self.noteWindow.bind('mouseover', function () {
    //     self.editingNote = true;
    //   }).bind('mouseout', function () {
    //     self.editingNote = false;
    //   });

    //   // textarea
    //   $('.note-text', self.noteWindow).placeholder().autogrow().focus()
    //       .bind('keyup', function (e) {
    //     if (!msg.is(':visible')) return;
    //     var val = body.val().trim();
    //     if (val !== '' && val !== body.attr('data-placeholder'))
    //       msg.hide();
    //   });

    //   // post button
    //   $('.note-post', self.noteWindow).bind('click', function (e) {
    //     msg.hide();
    //     var val = body.val().trim();
    //     if (val === '' || val === body.attr('data-placeholder')) {
    //       msg.text('Please enter text first.').show();
    //       return;
    //     }
    //     loading.show();

    //     note.val.text = $('<div>')
    //                     .html(body.val())
    //                     .text().trim();

    //     note.val.date = new Date().getTime();

    //     if (!isNew)
    //       delete note.val.channels;
    //     else
    //       note.val.channels = self.noteChannels;

    //     var _note = {
    //       beg: note.beg,
    //       end: note.end,
    //       val: note.val,
    //     };

    //     App.api.addNote(self.model.get('datasetId'),
    //                     { _note: [ _note ] }, function (err) {
    //       if (!err) {
    //         loading.hide();
    //         var noteClass = isNew ? 'note-user' : 'note-user-reply';
    //         var reply = $('<h2 class="' + noteClass + '">'
    //                     + (DEMO ? 'John Doe' : App.user.displayName)
    //                     + '<span class="note-content-date">' + ' '
    //                     + App.util.getRelativeTime(_note.val.date) + '</span></h2>'
    //                     + '<p class="note-body">' + App.util.formatNoteText(_note.val.text) + '</p>');
    //         reply.appendTo($('.note-content', self.noteWindow));

    //         if (isNew) {
    //           isNew = false;
    //           msg.text('Your comment has been posted.').show();
    //           body.attr('data-placeholder', 'Add reply here.');
    //           $('.note-post', self.noteWindow).text('Reply');
    //           $('.note-cancel', self.noteWindow).text('Close');
    //           $('.note-channels li', self.noteWindow).each(function () {
    //             var li = $(this);
    //             var cn = li.attr('data-channel-name');
    //             if (!cn) return;
    //             var a = $('<a class="note-channel-link jstree-draggable">'
    //                       + cn + '</a>');
    //             var span = $('<span style="color:lightgreen;">&nbsp;&nbsp;&#x2713;</span>');
    //             li.empty().append(a).append(span);
    //             if (!self.channelOnScreen(cn))
    //               $('span', li).hide();
    //           });
    //           self.addNoteChannelEvents(self.noteWindow);
    //         } else {
    //           msg.text('Your reply has been posted.').show();
    //         }
    //         var header = $('.note-header > span', self.noteWindow);
    //         var numReplies = $('.note-body', self.noteWindow).length;
    //         header.html(header.html().replace(/.*at/, numReplies + ' comments at'));
    //         body.val('').blur().focus();
    //         _.delay(function () {
    //           msg.fadeOut('slow');
    //         }, 2e3);
    //         $('.note-content').scrollTo('max', 500, {
    //                                     easing: App.easing.easeOutExpo });
    //         body.css({ height: '50px' });
    //         $('.timeline-icon', self.$el).remove();
    //         self.model.tabModel.resetEvents();
    //       } else if ('Permission denied.' === err) {
    //         self.cancelNote(null, plot);
    //         // TODO: Use growl style.
    //         alert('Permission denied.');
    //       } else throw new Error(err);
    //     });

    //   });

    //   // cancel anchor
    //   $('.note-cancel', self.noteWindow).bind('click', function (e) {
    //     self.cancelNote(null, plot);
    //   });

    //   // remove channel x's
    //   $('.note-channel-remove', self.noteWindow).bind('click',
    //       _.bind(self.removeNoteChannel, self));
    // },

    // fitNote: function (offset) {
    //   var self = this;
    //   if (!offset) offset = 0;
    //   // Add scroll bar to note text content if
    //   // greater than 200px tall.
    //   var noteContent = $('.note-content', self.noteWindow);
    //   if (noteContent.height() > 200)
    //      noteContent.css({'overflow-y': 'scroll', 'max-height': '200px'});

    //   // Ensure that the note window does not
    //   // end up off the screen.
    //   var winHeight = $(window).height();
    //   var noteYOffset = parseInt(self.el.offset().top) + offset;
    //   var windowOverlap = noteYOffset + self.noteWindow.height() - winHeight;
    //   if (windowOverlap > -10)
    //     self.noteWindow.css({ top: offset - windowOverlap - 10 });
    // },

    // addNoteChannelFromLabel: function (e) {
    //   var self = this;
    //   if (!self.noteBox) return;
    //   var noteChannelsList = $('.note-channels > ul', self.noteWindow);
    //   var channelName = 
    //       $(e.target).closest('[data-channel-name]').data('channel-name');
    //   if (!channelName) return;
    //   if (_.find(self.noteChannels, function (channel) { 
    //       return channel === channelName; })) return;
    //   $('<li>')
    //       .html(channelName + '&nbsp;<a class="note-channel-remove"' +
    //             'href="javascript:;" title="Remove channel">&nbsp;(&#x2717;)</a>')
    //       .addClass('note-channel')
    //       .data('channel-name', channelName)
    //       .appendTo(noteChannelsList)
    //       .bind('click', _.bind(self.removeNoteChannel, self));
    //   self.noteChannels.push(channelName);
    //   self.checkNoteChannelVis();
    // },

    // removeNoteChannel: function (e) {
    //   var li = $(e.target).closest('li');
    //   this.noteChannels = _.reject(this.noteChannels, function (channel) {
    //     return channel === li.data('channel-name');
    //   });
    //   li.remove();
    //   this.checkNoteChannelVis();
    // },

    // checkNoteChannelVis: function () {
    //   if (this.noteChannels.length === 0)
    //     $('.note-channels', this.el).hide();
    //   else
    //     $('.note-channels', this.el).show();
    // },

    // cancelNote: function (e, plot, fade, neighbor) {
    //   var self = this;
    //   if (self.noteWindow) {
    //     if (fade)
    //       self.noteWindow.fadeOut(200, _.bind(self.clearNoteWindow, self));
    //     else self.clearNoteWindow();
    //   }
    //   self.noteCanvas.hide();
    //   self.clearNoteBox();
    //   self.noteBox = null;
      
    //   if (neighbor) return;
    //   var otherGraphs = self.model.tabModel.graphModels;
    //   _.each(otherGraphs, function (gm) {
    //     if (gm.view.id !== self.id) {
    //       gm.view.cancelNote(e, null, fade, self);
    //     }
    //   });
    // },

    // clearNoteBox: function () {
    //   if (!this.noteBox) return;
    //   this.noteCtx.clearRect(this.noteBox.x, this.noteBox.y,
    //                         this.noteBox.w, this.noteBox.h);
    // },

    // clearNoteWindow: function () {
    //   $('.note-text', this.noteWindow).remove();
    //   this.noteWindow.remove();
    //   this.noteWindow = null;
    // },

    // redrawNote: function () {
    //   if (this.noteBox) {
    //     this.noteBox.h = this.plot.getPlaceholder().height();
    //     this.noteCtx.fillStyle = 'rgba(255,255,0,0.2)';
    //     this.noteCtx.clearRect(this.noteBox.x, this.noteBox.y,
    //                         this.noteBox.w, this.noteBox.h);
    //     this.noteCtx.fillRect(this.noteBox.x, this.noteBox.y,
    //                         this.noteBox.w, this.noteBox.h);
    //   }
    //   if (this.noteWindow)
    //     this.fitNote();
    // },

    // getNote: function (opts, note) {
    //   var self = this;
    //   opts = opts || {};
    //   _.defaults(opts, {
    //     isNew: true,
    //     onRight: true,
    //   });
    //   opts.note = $.extend(true, {}, note);
    //   _.each(opts.note.val.channels, function (channel, i) {
    //     opts.note.val.channels[i] = {
    //       channelName: channel,
    //       onScreen: self.channelOnScreen(channel),
    //     };
    //   });
    //   var n =  App.engine('note.jade', opts)
    //               .css({ top: opts.top, left: opts.left });
    //   $('.note-body', n).each(function () {
    //     var b = $(this);
    //     b.html(b.text());
    //   })
    //   $('textarea.note-text', n).bind('keyup', function (e) {
    //     _.delay(_.bind(self.fitNote, self), 100);
    //   });
    //   self.addNoteChannelEvents(n);
    //   return n;
    // },

    // addNoteChannelEvents: function (ctx) {
    //   var self = this;
    //   $('.note-channel-link', ctx)
    //   .click(function (e) {
    //     var _this = $(this);
    //     var check = $(this.nextElementSibling);
    //     if (check.is(':visible'))
    //       check.hide();
    //     else check.show();
    //     var target = _.find($('.tree li', self.model.get('tabModel').view.el),
    //                         function (li) {
    //       return $(li).attr('id') === _this.text();
    //     });
    //     if (target) $('a', target).click();
    //   })
    //   .bind('mouseenter', function (e) {
    //     var text = $(this).text();
    //     $('.legend tr', self.model.tabModel.view.el).each(function () {
    //       if ($('.label-wrap', this).attr('data-channel-name') === text)
    //         $(this).trigger('mouseenter');
    //     });
    //   })
    //   .bind('mouseleave', function (e) {
    //     var text = $(this).text();
    //     $('.legend tr', self.model.tabModel.view.el).each(function () {
    //       if ($('.label-wrap', this).attr('data-channel-name') === text)
    //         $(this).trigger('mouseleave');
    //     });
    //   });
    // },

    // openNote: function (nId, timeRange) {
    //   var self = this;
    //   if (!nId && !timeRange)
    //     this.cancelNote();
    //   if (nId)
    //     $('#' + nId).click();
    //   else if (timeRange)
    //     $(_.find(self.eventIcons, function (icon) {
    //       var data = $(icon).data();
    //       return parseInt(data.beg) === parseInt(timeRange.beg)
    //             && parseInt(data.end) === parseInt(timeRange.end);
    //     })).click();
    // },

    // getAllChannels: function () {
    //   var self = this;
    //   var channels = [];
    //   var allGraphs = self.model.tabModel.graphModels;
    //   _.each(allGraphs, function (gm) {
    //     channels.push(gm.get('channels'));
    //   });
    //   return _.flatten(channels);
    // },

    // channelOnScreen: function (channelName) {
    //   return _.find(this.model.get('tabModel')
    //                     .getAllChannelNames(),
    //                 function (cn) {
    //     return cn === channelName;
    //   }) ? true : false;
    // },

  });
});

