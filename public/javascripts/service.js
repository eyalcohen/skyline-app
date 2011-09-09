
// Establish dnode connection.
// TODO: make this more elegant?

var dnodeRemote;
var dnodeOnConnect = [];
DNode.connect({ reconnect: 500,  // Attempt to reconnect every 500ms.
              }, function (remote) {
  dnodeRemote = remote;
  dnodeOnConnect.forEach(function (args) { dnodeInvoke.apply(null, args); });
  dnodeOnConnect = null;
});

function dnodeInvoke() {
  if (dnodeRemote) {
    var f = dnodeRemote[arguments[0]];
    if (f) {
      f.apply(dnodeRemote, Array.prototype.slice.call(arguments, 1));
    } else {
      throw new Error('No dnode method ' + arguments[0]);
    }
  } else {
    dnodeOnConnect.push(arguments);
  }
};

/**
 * Merge samples which are adjacent or overlapping and share a value.
 * WARNING: this function is duplicated in sample_db.js and service.js - be sure
 * to keep both versions up to date.
 * TODO: figure out how to actually share code.
 *
 * @param samples Set of incoming samples, sorted by begin time.
 */
function mergeOverlappingSamples(samples) {
  // Index of first sample which might overlap current sample.
  var mightOverlap = 0;

  for (var i = 0; i < samples.length; ++i) {
    var s = samples[i];
    // Skip ahead until mightOverlap is a sample which could possibly overlap.
    while (samples[mightOverlap].end < s.beg)
      ++mightOverlap;
    for (var j = mightOverlap; j < i; ++j) {
      var t = samples[j];
      if (/*t.end >= s.beg &&*/ t.beg <= s.end &&
          t.val == s.val && t.min == s.min && t.max == s.max) {
        // Samples overlap - merge them.
        t.beg = Math.min(t.beg, s.beg);
        t.end = Math.max(t.end, s.end);
        samples.splice(i, 1);  // Delete sample i.
        --i;
        break;
      }
    }
  }
}

ServiceGUI = (function ($) {

  var expandDetailsTo = 500,

      orange = '#ff931a',
      blue = '#55f5f2',
      green = '#00f62e',
      red = '#fe110e',
      yellow = '#befe11',
      purple = '#5a1ada',

      mapStylez = [
        {
          featureType: 'administrative',
          elementType: 'all',
          stylers: [ { visibility: 'off' } ]
        },
        {
          featureType: 'landscape',
          elementType: 'all',
          stylers: [ { saturation: 100 } ]
        },
        {
          featureType: 'poi',
          elementType: 'all',
          stylers: [ { saturation: 100 } ]
        },
        {
          featureType: 'road',
          elementType: 'all',
          stylers: [ { saturation: -100 } ]
        },
        {
          featureType: 'transit',
          elementType: 'all',
          stylers: [ { visibility: 'off' } ]
        },
        {
          featureType: 'water',
          elementType: 'all',
          stylers: [ { saturation: -100 } ]
        },
      ],
      mapStyledOptions = {
        name: 'GrayScale',
      },

      search = function (by, val, fn) {
        jrid.empty();
        var data = {
          by: by,
          val: val
        };
        $.get('/search/' + val + '.json', data, fn);
      },

      mouse = function (e, r) {
        var px = 0;
        var py = 0;
        if (!e)
          var e = window.event;
        if (e.pageX || e.pageY) {
          px = e.pageX;
          py = e.pageY;
        } else if (e.clientX || e.clientY) {
          px = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          py = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (r) {
          var o = r.offset();
          px -= o.left;
          py -= o.top;
        }
        return { x: px, y: py };
      },

      flipTabSides = function (ctx) {
        var sides = $('.tab-side img', ctx);
        sides.each(function (i) {
          var $this = $(this),
              old = $this.attr('src'),
              noo = $this.attr('alt');
          $this.attr({ src: noo, alt: old });
        });
      },

      addCommas = function (n) {
        n += '';
        var x = n.split('.'),
            x1 = x[0],
            x2 = x.length > 1 ? '.' + x[1] : '',
            rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
          x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
      },

      addLandingMap = function () {
        var wrap = $('#landing-map'),
            chicago = new google.maps.LatLng(39.6,-94.35),
            map,
            mapOptions = {
              zoom: 4,
              center: chicago,
              disableDefaultUI: true,
              mapTypeControlOptions: {
                mapTypeIds: [ google.maps.MapTypeId.ROADMAP, 'greyscale' ]
              }
            },
            mapType = new google.maps.StyledMapType(mapStylez, mapStyledOptions);

        // make new map
        map = new google.maps.Map(wrap[0], mapOptions);
        map.mapTypes.set('grayscale', mapType);
        map.setMapTypeId('grayscale');

        // ready
        google.maps.event.addListener(map, 'tilesloaded', function () {
          google.maps.event.trigger(map, 'resize');
          wrap.removeClass('map-tmp');
        });
      },

      sizeDetailPanes = function () {
        var ww = $(window).width(),
            lw = Math.ceil((ww - 9) * 0.3),
            rw = Math.floor((ww - 9) * 0.7);
        $('.details-left').width(lw);
        $('.details-right').width(rw);
      },

      relativeTime = function (ts) {
        ts = parseInt(ts);
        var parsed_date = new Date(ts / 1000),
            relative_to = (arguments.length > 1) ? arguments[1] / 1000 : new Date(),
            delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
        if (delta < 5) return 'just now';
        else if (delta < 15) return 'just a moment ago';
        else if (delta < 30) return 'just a few moments ago';
        else if (delta < 60) return 'less than a minute ago';
        else if (delta < 120) return 'about a minute ago';
        else if (delta < (45 * 60)) return (parseInt(delta / 60)).toString() + ' minutes ago';
        else if (delta < (90 * 60)) return 'about an hour ago';
        else if (delta < (24 * 60 * 60)) {
          var h = (parseInt(delta / 3600)).toString();
          if (h != '1') return 'about ' + h + ' hours ago';
          else return 'about an hour ago';
        }
        else if (delta < (2 * 24 * 60 * 60)) return 'about a day ago';
        else if (delta < (10 * 24 * 60 * 60)) return (parseInt(delta / 86400)).toString() + ' days ago';
        else return new Date(ts / 1000).toLocaleDateString();
      },

      updateTimes = function () {
        $('[data-last-seen]').each(function (i) {
          var time = $(this);
          if (!time.data('ts'))
            time.data('ts', time.attr('data-last-seen'));
          time.text(relativeTime(time.data('ts')));
        });
      };

  var Sandbox = function (vehicleId, cycles, fn) {
    this.vehicleId = vehicleId;
    this.cycles = cycles;
    // plotter and map ref holder
    this.widgets = [];
    // TODO: fetch this from server
    this.schema = {
      // kevinh - for testing/demo until the client fetches the schema from
      // the server
      'mc/controllerTemperature': {
        title: 'Motor Temperature',
        label: 'mDegC',
        unit: 'C',
      },
      'mc/motorSpeed': {
        title: 'Motor Speed',
        label: 'mRPM',
        unit: 'RPM',
      },
      'pm/packCurrent100ms': {
        title: 'Pack Current Draw',
        label: 'pAmp',
        unit: 'A',
      },
      'pm/lvSystemCurrent100ms': {
        title: 'LV CurrentDraw',
        label: 'pLVAmp',
        unit: 'A',
      },
      'pm/packVoltage_V': {
        title: 'Pack Voltage',
        label: 'pV',
        unit: 'V',
      },
      'pm/packTemperature': {
        title: 'Pack Temperature',
        label: 'bDegC',
        unit: 'C',
      },
      'gps.speed_m_s': {
        title: 'GPS Speed',
        label: 'spd',
        unit: 'm/s',
      },
      'gps.latitude_deg': {
        title: 'GPS Latitude',
        label: 'lat',
        unit: '°',
      },
      'gps.longitude_deg': {
        title: 'GPS Longitude',
        label: 'lng',
        unit: '°',
      },
      'gps.altitude_m': {
        title: 'GPS Altitude',
        label: 'alt',
        unit: 'm',
      },
      'accel.x_m_s2': {
        title: 'Acceleration X',
        label: 'acx',
        unit: 'm/s^2',
      },
      'accel.y_m_s2': {
        title: 'Acceleration Y',
        label: 'acy',
        unit: 'm/s^2',
      },
      'accel.z_m_s2': {
        title: 'Acceleration Z',
        label: 'acz',
        unit: 'm/s^2',
      },
      'compass.x_deg': {
        title: 'Heading X',
        label: 'cpx',
        unit: '°',
      },
      'compass.y_deg': {
        title: 'Heading Y',
        label: 'cpy',
        unit: '°',
      },
      'compass.z_deg': {
        title: 'Heading Z',
        label: 'cpz',
        unit: '°',
      },
    };

    this.availableChannels = [];  // currently available channels
    this.sampleSet = {};
    this.fetchedRange = null;  // Time range which has been fetched.  (For now, just one.)
    this.fetchedChannels = Object.keys(this.schema);

    // start with latest cycle only
    var lastCycle = cycles[cycles.length - 1];
    var self = this;
    this.reEvaluateData({ range: [lastCycle.beg / 1000, lastCycle.end / 1000] }, function () {
      fn.call(self);
    });
    
    // tmp:
    function checkForMore() {
      setTimeout(function () {
        self.reEvaluateData({ range: [lastCycle.beg / 1000, new Date().getTime()] }, function () {
          self.timeseries.updateData([lastCycle.beg / 1000, new Date().getTime()]);
          checkForMore();
        }, true);
      }, 10000);
    }
    //checkForMore();
  };

  Sandbox.prototype.parseVisibleCycles = function () {
    var self = this;

    // update available channels
    self.availableChannels = Object.keys(this.schema).filter(
      function(channelName) {
        return null != self.sampleSet[channelName] &&
            self.sampleSet[channelName].length > 0;
      }
    );
  };

  Sandbox.prototype.add = function (type, wrap, loading, fn) {
    switch (type) {
      case 'Map':
        // Don't attempt to add map if Maps API didn't load.
        if (typeof google !== 'undefined' && google.maps) {
          this.map = new Map(this, wrap, loading);
          this.widgets.push(this.map);
          this.map.init(fn);
        }
        break;
      case 'TimeSeries':
        this.timeseries = new TimeSeries(this, wrap, loading);
        this.widgets.push(this.timeseries);
        this.timeseries.init(fn);
        break;
      case 'Overviewer':
        this.overviewer = new Overviewer(this, wrap);
        this.widgets.push(this.overviewer);
        this.overviewer.init();
        break;
    }
  };

  Sandbox.prototype.notify = function (type, params, fn) {
    switch (type) {
      case 'cs-time-window-change':
        this.reEvaluateData(params, fn);
        if (!params.skipOverview)
          this.overviewer.update(params.range);
        break;
      case 'cs-point-hover':
        if (this.map)
          this.map.update(params.time);
        break;
      case 'cs-map-cursormove':
        this.timeseries.update(params);
        break;
      case 'cs-map-cursorout':
        this.timeseries.clearSelection();
        break;
    }
  };

  Sandbox.prototype.reEvaluateData = function (params, fn, force) {

    var self = this;
    var beginTime = params.range[0] * 1000, endTime = params.range[1] * 1000;

    // reload if new bounds exceed what's loaded
    var reload = !self.fetchedRange ||
        beginTime < self.fetchedRange[0] || endTime > self.fetchedRange[1];
    if (reload || force) {
      console.log('reloading...');
      // show loading for this chart
      // if (this.timeseries)
      //   this.timeseries.showLoading();

      // HACK: Expand range by 2x to avoid excessive reloading.
      if (!force) {
        var deltaTime = endTime - beginTime;
        beginTime = beginTime - deltaTime / 2;
        endTime = endTime + deltaTime / 2;
      }

      // call server
      self.fetchedRange = [beginTime, endTime];
      var callsPending = self.fetchedChannels.length;
      self.fetchedChannels.forEach(function (channelName) {
        dnodeInvoke('fetchSamples', ServiceGUI.sessionInfo,
                    self.vehicleId, channelName,
                    { beginTime: beginTime, endTime: endTime }, //, subscribe: channelName },
                    function(err, samples) {
          if (samples)
            self.sampleSet[channelName] = samples;
          if (err)
            console.log(err.stack);
          if (--callsPending == 0) {
            self.parseVisibleCycles();
            fn(true);
          }
        });
      });
    } else
      fn(false);
  };

  var TimeSeries = function (box, wrap) {

    var defaultSeries = ['pm/packCurrent100ms', 'pm/packTemperature'],
        charts = [],
        plotColors = [orange, blue, green, red, yellow, purple],
        blockRedraw = false,
        overviewHeight = $('.overviewer', wrap).height() + 5,

        makeChart = function (params) {

          var chart = new Dygraph(wrap[0], params.points, {
              width: wrap.width(),
              height: (wrap.height() - (5 * (params.of - 1)) - overviewHeight) / params.of,
              index: params.index,
              of: params.of,
              channels: box.availableChannels,
              key: params.key,
              sensor: params.sensor,
              rightGap: 0,
              fillGraph: true,
              fillAlpha: 0.05,
              gridLineColor: 'rgba(255,255,255,0.25)',
              colorOne: orange,
              colorTwo: '#ffffff',
              strokeWidth: 0.5,
              labels: ['time'].concat(params.labels),
              axisLineColor: 'rgba(0,0,0,0)',
              axisLabelColor: '#808080',
              axisLabelFontSize: 9,
              xlabel: 'Time',
              ylabel: params.titles,
              stepPlot: true,
              starts: [],  // TODO: this will make all cycles connected
              dateWindow: params.dateWindow,

              interactionModel : {
                mousedown: downV3,
                mousemove: moveV3,
                mouseup: upV3,
                click: clickV3,
                dblclick: dblClickV4,
                mousewheel: scrollV3,
                DOMMouseScroll: scrollV3
              },

              highlightCallback: function(e, x, pts, row) {

                // notify sandbox
                box.notify('cs-point-hover', {
                  time: new Date(x)
                });
              },

              drawCallback: function (me, initial) {
                if (initial) return;

                // get new date window
                var range = me.xAxisRange(),
                    yrange = me.yAxisRange();

                // notify sandbox
                box.notify('cs-time-window-change', {
                  range: range
                }, function (redraw) {

                  if (charts.length < me.of || blockRedraw)
                    return;

                  blockRedraw = true;

                  if (redraw) {
                    updateData(range);
                    hideLoading();
                  } else {
                    for (var i = 0, len = charts.length; i < len; i++) {
                      if (charts[i] == me || !charts[i].file_)
                        continue;
                      charts[i].updateOptions({
                        dateWindow: range
                      }, true);
                    }
                  }

                  blockRedraw = false;

                });
              }
          });

          return chart;

        },

        bindRightClickMenu = function (self) {
          $('canvas', wrap).not('.overviewer-canvas').contextMenu('context-menu-1', {
              'Insert Plot Below...': {
                click: function (el) {
                  var i = el.itemID(),
                      chart = charts[i];

                  // make a new dygraph
                  var channelName = Object.keys(box.schema)[0];
                  var chanSchema = box.schema[channelName];
                  var colors = plotColors[0];
                  var newChart = makeChart({
                    points: getSamples(channelName),
                    of: chart.of + 1,
                    index: chart.index + 1,
                    self: self,
                    key: channelName,
                    sensor: channelName,
                    labels: [ chanSchema.label ],
                    titles: [ chanSchema.title + ' (' + chanSchema.unit + ')' ],
                  });

                  // collect it for later
                  charts.splice(i, 0, newChart);

                  // update other charts
                  for (var j = 0, len = charts.length; j < len; j++) {
                    charts[j].updateOptions({
                      of: len,
                      index: j,
                      siblings: charts,
                    }, true);
                  }

                  // resize container
                  self.resize();
                }
              },
              'Delete': {
                click: function (el) {
                  var i = el.itemID();

                  // kill it
                  charts[i].destroy();

                  // remove index in list
                  charts.splice(i, 1);

                  // update other charts
                  for (var j = 0, len = charts.length; j < len; j++) {
                    charts[j].updateOptions({
                      of: len,
                      index: j,
                    }, true);
                  }

                  // resize container
                  self.resize();
                }
              }
            },
            {
              showMenu: function() {},
              hideMenu: function() {}
            }
          );
        },

        showLoading = function () {
          $('.loading-more', wrap).show()
        },

        hideLoading = function () {
          $('.loading-more', wrap).hide();
        },

        combineSeries = function (s1, s2) {
          var combined = [],
              times = [],
              s1o = {},
              s2o = {};

          // create list of all times
          for (var i = 0, len = Math.max(s1.length, s2.length); i < len; i++) {
            var t1 = s1[i] ? s1[i][0] : null,
                t2 = s2[i] ? s2[i][0] : null;
            if (t1)
              times.push(t1);
            if (t2 && t2 !== t1)
              times.push(t2);
          }

          // ensure proper order
          times.sort(function (a, b) { return a - b; });

          // create objects from sets (for searching)
          for (var i = 0, len = s1.length; i < len; i++)
            s1o[s1[i][0]] = s1[i][1];
          for (var i = 0, len = s2.length; i < len; i++)
            s2o[s2[i][0]] = s2[i][1];

          // build combines data
          for (var i = 0, len = times.length; i < len; i++) {

            // get times
            var t = times[i],
                tl = times[i - 1],
                p = [t];

            // get one value
            if (s1o[t]) {
              p.push(s1o[t]);
            } else if (s1o[tl]) {
              s1o[t] = s1o[tl];
              p.push(s1o[tl]);
            } else {
              p.push(NaN);
            }

            // get second value
            if (s2o[t]) {
              p.push(s2o[t]);
            } else if (s2o[tl]) {
              s2o[t] = s2o[tl];
              p.push(s2o[tl]);
            } else {
              p.push(NaN);
            }

            combined.push(p);
          }

          // return the combined dataset
          return combined;

        },

        updateData = function (newRange) {
          console.log('updating...');
          // update plots with new data
          for (var i = 0, len = charts.length; i < len; i++) {
            var sen = charts[i].sensor, ser = getSamples(sen);
            var chanSchema = box.schema[sen];
            var newOptions;
            if (charts[i].sensor2) {
              var sen2 = charts[i].sensor2, ser2 = getSamples(sen2);
              var combinedDataSet = combineSeries(ser, ser2);
              var chanSchema2 = box.schema[sen2];
              newOptions = {
                file: combinedDataSet,
                labels: [ 'time', chanSchema.label, chanSchema2.label ],
                ylabel: chanSchema.title + ' (' + chanSchema.unit + ')',
                ylabel2: chanSchema2.title + ' (' + chanSchema2.unit + ')',
              };
            } else {
              newOptions = {
                file: ser,
                labels: [ 'time', chanSchema.label ],
                ylabel: chanSchema.title + ' (' + chanSchema.unit + ')',
                ylabel2: null,
              };
            }
            if (newRange)
              newOptions.dateWindow = newRange;
            charts[i].updateOptions(newOptions, true);
          }
        },

        getSamples = function (channelName) {
          var samples = box.sampleSet[channelName];
          if (!samples)
            return null;
          return samples.map(function(sample) {
            return [sample.beg / 1000, sample.val];
          });
        };

    return {
      
      updateData: updateData,

      init: function (fn) {
        // plot data
        this.plot(fn);

        // HACK: fix size.
        this.resize();

        // channel selects
        var self = this;
        $('select', wrap).live('change', function () {
          var $this,
              clear;
          if ($(this).val() !== 'choose') {
            $this = $(this);
          } else {
            clear = true;
            $this = $('select', this.parentNode.parentNode.previousElementSibling);
          }

          var chart = charts[$this.parent().itemID()],
              sensor = $this.val(),
              $sibling = $this.hasClass('select1') ?
                $('select', this.parentNode.parentNode.nextElementSibling) :
                $('select', this.parentNode.parentNode.previousElementSibling),
              siblingSensor = $sibling.val();

          if (siblingSensor !== 'choose' && !clear) {

            var sensorOne,
                sensorTwo;

            if ($this.hasClass('select1')) {
              sensorOne = sensor;
              sensorTwo = siblingSensor;
            } else {
              sensorOne = siblingSensor;
              sensorTwo = sensor;
            }

            // update chart options
            chart.updateOptions({ sensor: sensorOne, sensor2: sensorTwo }, true );

            // ensure no double options
            var children = $sibling.children();
            children.each(function (j) {
              var opt = $(children[j]);
              if (opt.val() === $this.val()) {
                opt.attr('disabled', 'disabled');
              } else {
                opt.removeAttr('disabled');
              }
            });
            $('select', wrap).sb('refresh');

          } else {

            // update chart options
            chart.updateOptions({ sensor: sensor, sensor2: null }, true);

          }

          // update chart data given current sensors
          updateData();

        });

        // init right clicks
        bindRightClickMenu(self);
      },

      plot: function (desiredSeries, fn) {

        // save this scope
        var self = this,
            sensors = box.visibleSensors;

        if (!fn) {
          fn = desiredSeries;
          desiredSeries = defaultSeries;
        }

        // create each chart
        var lastCycle = box.cycles[box.cycles.length - 1];
        var range = [lastCycle.beg / 1000, lastCycle.end / 1000];
        desiredSeries.forEach(function(channelName, i) {
          var channelName = desiredSeries[i];
          var colors = plotColors[0];

          // make a new dygraph
          var chanSchema = box.schema[channelName];
          var chart = makeChart({
              points: getSamples(channelName),
              of: desiredSeries.length,
              index: i,
              self: self,
              key: channelName,
              colors: colors,
              sensor: channelName,
              labels: [ chanSchema.label ],
              titles: [ chanSchema.title + ' (' + chanSchema.unit + ')' ],
              dateWindow: range,
          });

          // collect it for later
          charts.push(chart);
        });

        // add siblings ref
        charts.forEach(function(chart) {
          chart.updateOptions({ siblings: charts }, true);
        });

        // init the dropdowns
        $('select', wrap).sb({
          fixedWidth: true,
          animDuration: 50
        });

        // add class names to color picker
        $('.colors', wrap).each(function (i) {
          if (i % 2 == 0)
            $(this).addClass('for-plot-one');
          else
             $(this).addClass('for-plot-two');
        });

        // init color picker
        $('.colors', wrap).miniColors({
          change: function(hex, rgb) {
            var $this = $(this),
                chart = charts[$this.itemID()],
                colorOne;

            // update chart
            if ($this.hasClass('for-plot-one')) {
              chart.updateOptions({
                colorOne: hex
              }, true);
            } else {
              chart.updateOptions({
                colorTwo: hex
              }, true);
            }
          }
        });

        // color in the squares
        $('.miniColors-trigger', wrap).each(function (i) {
          var color = $(this.parentNode).attr('class').split(' ')[1].split('-')[1];
          $(this).css({ backgroundColor: color });
        });

        // callback
        fn();
      },

      snap: function (range, fn) {

        // notify sandbox
        box.notify('cs-time-window-change', {
          range: range,
          skipOverview: true
        }, function (redraw) {

          // update plots with new data
          if (redraw) {
            updateData(range);
          }

          hideLoading();
          fn();
        });
      },

      resize: function (wl, hl, wr, hr) {
        var self = this;

        if (!wr)
          wr = wrap.width();
        if (!hr)
          hr = wrap.height();
        for (var i = 0, len = charts.length; i < len; i++) {
          charts[i].resize(wr, (hr - (5 * (len - 1)) - overviewHeight) / len);
        }

        // init the dropdowns
        $('select', wrap).sb({
          fixedWidth: true,
          animDuration: 50
        });

        // add class names to color picker
        $('.colors', wrap).each(function (i) {
          if (i % 2 == 0)
            $(this).addClass('for-plot-one');
          else
             $(this).addClass('for-plot-two');
        });

        // init color picker
        $('.colors', wrap).miniColors({
          change: function(hex, rgb) {
            var $this = $(this),
                chart = charts[$this.itemID()],
                colorOne;

            // update chart
            if ($this.hasClass('for-plot-one')) {
              chart.updateOptions({
                colorOne: hex
              }, true);
            } else {
              chart.updateOptions({
                colorTwo: hex
              }, true);
            }
          }
        });

        // color in the squares
        $('.miniColors-trigger', wrap).each(function (i) {
          var color = $(this.parentNode).attr('class').split(' ')[1].split('-')[1];
          $(this).css({ backgroundColor: color });
        });

        // init right clicks
        bindRightClickMenu(self);
      },

      update: function (time) {
        for (var i = 0, len = charts.length; i < len; i++) {
          charts[i].highlight_(time);
        }
      },

      showLoading: showLoading,

      getChart: function (index) {
        return charts[index];
      },
      
      clearSelection: function () {
        for (var i = 0, len = charts.length; i < len; i++) {
          charts[i].clearSelection();
        }
      },

      clear: function () {
        for (var i = 0, len = charts.length; i < len; i++) {
          charts[i].destroy();
        }
      },

    };
  };

  var Overviewer = function (box, wrap) {

    var width = wrap.width(),
        height = wrap.height(),
        slider = $('.overviewer-slider', wrap),
        dotsCanvas = $('<canvas class="overviewer-canvas" width="' + width + '" height="' + height + '"></canvas>'),
        dragCanvas = $('<canvas class="overviewer-canvas" width="' + width + '" height="' + height + '"></canvas>'),
        dotsCtx = dotsCanvas[0].getContext('2d'),
        dragCtx = dragCanvas[0].getContext('2d'),
        bounds = {},
        padding,
        dots = [],
        scale,
        dragBounds = [],
        visibleDots = [],
        mappedDot,

        updateDots = function () {

          // clear canvas
          dotsCtx.clearRect(0, 0, width, height);

          // reset dots
          for (var i = 0, len = dots.length; i < len; i++) {
            var dot = dots[i];
            dot.color = '#ffffff';
            dot.screenX = msToPx(dot.time);
          }
        },

        renderDots = function () {
          for (var i = 0, len = dots.length; i < len; i++) {
            dots[i].draw(dotsCtx);
          }
        },

        clearDrag = function () {

          // clear canvas
          dragCtx.clearRect(0, 0, width, height);
        },

        renderDrag = function () {

          // draw select box
          dragCtx.fillRect(dragBounds[0], 0, dragBounds[1] - dragBounds[0], height);
        },

        // time to pixel mapping
        msToPx = function (ms) {
          return ms * scale - scale * bounds.start;
        },

        // pixel to time mapping
        pxToMs = function (px) {
          return parseInt((px + scale * bounds.start) / scale);
        },

        // force graphics to half-pixels
        crisper = function (v) {
          return Math.round(v) + 0.5;
        },

        setMappedDot = function (dot) {
          mappedDot = dot;
          mappedDot.color = green;
        };

    return {
      init: function () {

        // add to doc
        dragCanvas.appendTo(wrap);
        dotsCanvas.appendTo(wrap);

        // text select tool fix for chrome on mousemove
        dotsCanvas[0].onselectstart = function () {
          return false;
        };

        // get global bounds for all events
        bounds.start = box.cycles[0].beg / 1000;
        bounds.stop = box.cycles[box.cycles.length - 1].end / 1000;

        // padding will be 2% or total time shown
        padding = 0.02 * (bounds.stop - bounds.start);

        // include padding
        bounds.start -= padding;
        bounds.stop += padding;

        // determine ms / px
        scale = width / (bounds.stop - bounds.start);

        // plot cycles
        box.cycles.forEach(function(cycle, i) {
          var dot = new Dot();
          dot.range = [cycle.beg / 1000, cycle.end / 1000];
          dot.time = Math.round((cycle.beg + cycle.end) / 2) / 1000;
          dot.screenX = msToPx(dot.time);
          //dot.radius = scale * (box.raw[i].bounds.stop - box.raw[i].bounds.start) / (bounds.stop - bounds.start);
          dots.push(dot);
          if (i === box.cycles.length - 1)
            setMappedDot(dot);
          dot.draw(dotsCtx);
        });

        wrap.live('click', function (e) {

          // get mouse position
          var m = mouse(e, dotsCanvas);

          // find nearby dots
          for (var i = 0, len = dots.length; i < len; i++) {
            if (m.x <= dots[i].screenX + dots[i].radius &&
              m.x >= dots[i].screenX - dots[i].radius &&
              m.y <= dots[i].screenY + dots[i].radius &&
              m.y >= dots[i].screenY - dots[i].radius
            ) {
              updateDots();
              var dot = dots[i];
              setMappedDot(dot);
              renderDots();
              if (box.map)
                box.map.showLoading();
              box.timeseries.snap(dot.range, function () {
                if (box.map) {
                  box.map.clear();
                  box.map.refresh(dot.range);
                }
              });
              break;
            }
          }

        });

        dragCtx.fillStyle = '#ffffff';
        dragCtx.globalAlpha = 0.2;

        wrap.live('mousedown', function (e) {

          // get mouse position
          var m_orig = mouse(e, dragCanvas);

          // clear dots
          var draggedDots = [];

          // bind mouse move
          var movehandle = function (e) {

            // get mouse position
            var m = mouse(e, dragCanvas);

            if (m.x === m_orig.x)
              return;
            else if (m.x > m_orig.x) {
              dragBounds[0] = m_orig.x;
              dragBounds[1] = m.x;
            } else if (m.x < m_orig.x) {
              dragBounds[0] = m.x;
              dragBounds[1] = m_orig.x;
            }

            // draw the rectangle
            clearDrag();
            renderDrag();

            // find nearby dots
            for (var i = 0, len = dots.length; i < len; i++) {
              if (dragBounds[0] <= dots[i].screenX - dots[i].radius &&
                dragBounds[1] >= dots[i].screenX + dots[i].radius
              ) {
                if (draggedDots.indexOf(dots[i]) === -1)
                  draggedDots.push(dots[i]);
              }
            }

          };
          $(document).bind('mousemove', movehandle);

          // bind mouse up
          $(document).bind('mouseup', function () {

            // remove all
            $(this).unbind('mousemove', movehandle).unbind('mouseup', arguments.callee);

            // erase select box
            clearDrag();

            // check if got any dots
            if (draggedDots.length === 0)
              return;

            // clear dots
            updateDots();

            // find selected dot range
            var range = [bounds.stop, bounds.start];
            for (var i = 0, len = draggedDots.length; i < len; i++) {
              var dot = draggedDots[i];
              dot.color = orange;
              if (dot.range[0] < range[0])
                range[0] = dot.range[0];
              if (dot.range[1] > range[1])
                range[1] = dot.range[1];
            }

            // last dot will be mapped and colored differently
            setMappedDot(dot);

            // draw dots
            renderDots();

            // update map and plots
            if (box.map)
              box.map.showLoading();
            box.timeseries.snap(range, function () {
              if (box.map) {
                box.map.clear();
                box.map.refresh(dot.range);
              }
            });

          });
        });

      },

      update: function (windowBounds) {

        // clear visible
        visibleDots = [];

        // clear all
        updateDots();

        // find dots
        for (var i = 0, len = dots.length; i < len; i++) {
          var dot = dots[i];
          if (windowBounds[0] < dot.range[1] &&
              windowBounds[1] > dot.range[0]) {
            // highlight
            dot.color = orange;
            visibleDots.push(dot);
          }
        }

        // recolor mapped dot
        mappedDot.color = green;

        // redraw
        renderDots();
      },

      updateMapped: function (mappedBounds) {

        // convert bounds to epoch time
        for (var t = 0, len = mappedBounds.length; t < len; t++)
          mappedBounds[t] = mappedBounds[t].valueOf();

        // this is the cycle that is mapped
        var dot;

        // clear all
        updateDots();

        // recolor visible dots
        for (var i = 0, len = visibleDots.length; i < len; i++)
          visibleDots[i].color = orange;

        // find the mapped one
        for (var i = 0, len = dots.length; i < len; i++) {
          if (mappedBounds[0] < dots[i].time &&
              mappedBounds[1] > dots[i].time) {
            // color this one green
            setMappedDot(dots[i]);
          }
        }

        // redraw
        renderDots();
      },

      resize: function (wl, hl, wr, hr) {

        // get width again
        width = wrap.width();

        // redo scale
        scale = width / (bounds.stop - bounds.start);

        // size canvases
        dotsCanvas.attr('width', width);
        dragCanvas.attr('width', width);

        // redraw
        dotsCtx.clearRect(0, 0, width, height);
        renderDots();

      },

      clear: function () {}
    };
  };

  var Dot = function () {

    return {

      range: null,
      time: null,
      mapped: false,
      screenX: null,
      screenY: 10,
      color: '#ffffff',
      opacity: 0.5,
      radius: 5,

      draw: function (ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.screenX, this.screenY, this.radius, 0, 2 * Math.PI);
        ctx.fill();
      },

    };

  };

  var Map = function (box, wrap, loading) {

    var gpsPoints,
        timeBounds,
        cellPoints,
        times,
        map,
        mapWidth,
        mapHeight,
        mapOptions,
        mapType,
        poly,
        distance,
        dots,
        cellDots,
        dotStyle,
        cellDotStyle,
        start,
        end,
        cursor,
        firstRun,
        loadedHandle,
        dragHandle,
        leaveHandle,

        refreshVars = function () {
          gpsPoints = {};
          cellPoints = {};
          times = [];
          mapWidth = wrap.width();
          mapHeight = wrap.height();
          mapOptions = {
            disableDefaultUI: true,
            mapTypeControlOptions: {
              mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'greyscale'],
            },
          };
          mapType = new google.maps.StyledMapType(mapStylez, mapStyledOptions);
          poly = new google.maps.Polyline({
            strokeColor: '#000000',
            strokeOpacity: 0.6,
            strokeWeight: 8,
            clickable: false,
          });
          dots = [];
          cellDots = [];
          dotStyle = {
            strokeWeight: 0,
            fillColor: "#ffffff",
            fillOpacity: 0.5,
            radius: 10,
            clickable: false,
          };
          cellDotStyle = {
            strokeWeight: 0,
            fillColor: "#ff00ff",
            fillOpacity: 0.5,
            radius: 50,
            clickable: false,
          };
          firstRun = true;
        },

        plot = function (fn) {

          // inits
          var src = box.sampleSet;
          if (!src) {
            fn(true);
            return;
          }
          var latData = src['gps.latitude_deg'],
              lngData = src['gps.longitude_deg'],
              len = latData && lngData && Math.min(latData.length, lngData.length);
          if (!len) {
            fn(true);
            return;
          }
          if (lngData.length != latData.length)
            console.log("Latitude and longitude counts don't match!");
          // init data points time boundary
          if (!timeBounds) {
            var lastCycle = box.cycles[box.cycles.length - 1];
            timeBounds = [lastCycle.beg, lastCycle.end];
          }

          // clear for new map
          refreshVars();

          // poly bounds
          var minlat = 90,
              maxlat = -90,
              minlng = 180,
              maxlng = -180;

          // built poly
          // TODO: don't rely on lat & lng arrays being synchronized!
          for (var i = 0; i < len; i++) {
            var time = latData[i].beg;
            if (lngData[i].beg != time)
              console.log("Latitude and longitude times don't match!");
            if (time >= timeBounds[0] && time <= timeBounds[1]) {
              var lat = latData[i].val,
                  lng = lngData[i].val;
              if (lat < minlat) minlat = lat;
              if (lat > maxlat) maxlat = lat;
              if (lng < minlng) minlng = lng;
              if (lng > maxlng) maxlng = lng;
              var ll = new google.maps.LatLng(lat, lng);
              var d = new google.maps.Circle(dotStyle);
              d.setCenter(ll);
              dots.push(d);
              poly.getPath().push(ll);
              gpsPoints[time.valueOf()] = ll;
            }
          }

          // make array of times
          times = Object.keys(gpsPoints);

          // get path length
          distance = google.maps.geometry.spherical.computeLength(poly.getPath());

          // make map bounds
          var sw = new google.maps.LatLng(minlat, minlng),
              ne = new google.maps.LatLng(maxlat, maxlng),
              mapBounds = new google.maps.LatLngBounds(sw, ne);

          // make new map
          map = new google.maps.Map(wrap[0], mapOptions);
          map.mapTypes.set('grayscale', mapType);
          map.setMapTypeId('grayscale');

          // set objects
          poly.setMap(map);
          for (var k = 0, len = dots.length; k < len; k++)
            dots[k].setMap(map);
          for (var k = 0, len = cellDots.length; k < len; k++)
            cellDots[k].setMap(map);

          // cursor
          cursor = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: poly.getPath().getAt(0),
            icon: 'http://google-maps-icons.googlecode.com/files/car.png',
            zIndex: 1000001,
            clickable: false,
          });

          // endpoints
          var imageA = new google.maps.MarkerImage("/graphics/black_MarkerA.png",
                      new google.maps.Size(20.0, 34.0),
                      new google.maps.Point(0, 0),
                      new google.maps.Point(10.0, 34.0));

          var imageB = new google.maps.MarkerImage("/graphics/black_MarkerB.png",
                      new google.maps.Size(20.0, 34.0),
                      new google.maps.Point(0, 0),
                      new google.maps.Point(10.0, 34.0));

          var shadow = new google.maps.MarkerImage("graphics/marker-shadow.png",
                      new google.maps.Size(38.0, 34.0),
                      new google.maps.Point(0, 0),
                      new google.maps.Point(10.0, 34.0));

          start = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: poly.getPath().getAt(0),
            icon: imageA,
            shadow: shadow,
            clickable: false,
          });

          end = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: poly.getPath().getAt(poly.getPath().getLength() - 1),
            icon: imageB,
            shadow: shadow,
            clickable: false,
          });

          // center and zoom
          map.setCenter(mapBounds.getCenter());
          map.fitBounds(mapBounds);

          // enter map
          enterHandle = google.maps.event.addListener(map, 'mouseover', function (e) {

            // show time
            $('.map-time', wrap.parent()).show();
          });

          // clear plot when leave map
          leaveHandle = google.maps.event.addListener(map, 'mouseout', function (e) {

            // notify sandbox
            box.notify('cs-map-cursorout');

            // hide time
            $('.map-time', wrap.parent()).hide();
          });

          // move cursor on mouse hover
          dragHandle = google.maps.event.addListener(map, 'mousemove', function (e) {

            // inits
            var minDist = 1e+100,
                snapTo,
                keys = Object.keys(e.latLng);

            // find closest point
            times.forEach(function (t) {

              // compute distances
              var deltaLat = Math.abs(gpsPoints[t][keys[0]] - e.latLng[keys[0]]),
                  deltaLawn = Math.abs(gpsPoints[t][keys[1]] - e.latLng[keys[1]]),
                  dist = Math.sqrt((deltaLat * deltaLat) + (deltaLawn * deltaLawn));

              // compare distance
              if (dist < minDist) {
                minDist = dist;
                snapTo = { time: parseInt(t), latLng: gpsPoints[t] };
              }

            });

            // move the cursor
            if (snapTo) {
              cursor.setPosition(snapTo.latLng);

              // notify sandbox
              box.notify('cs-map-cursormove', snapTo.time);
            }

            // update time
            var timeTxt = (new Date(snapTo.time / 1000)).toLocaleString();
            var gmti = timeTxt.indexOf(' GMT');
            if (gmti !== -1)
              timeTxt = timeTxt.substr(0, gmti);
            $('.map-time', wrap.parent()).text(timeTxt);
          });

          // ready
          loadedHandle = google.maps.event.addListener(map, 'tilesloaded', function () {
            if (firstRun) {
              firstRun = false;
              google.maps.event.trigger(map, 'resize');
              map.setCenter(mapBounds.getCenter());
              map.fitBounds(mapBounds);
              if (fn) fn();
              wrap.removeClass('map-tmp');
              showInfo();
            }
          });
        },

        toMiles = function (m) {
          return m / 1609.344;
        },

        showInfo = function () {
          var distanceTxt = 'Distance traveled: ' + addCommas(distance.toFixed(2)) + ' m',
              timeTxt = 'Cycle duration: ' + addCommas(((parseInt(times[times.length - 1]) - parseInt(times[0])) / 1000000 / 60).toFixed(2)) + ' min',
              infoP = $('.map-info', wrap.parent()),
              timeP = $('.map-time', wrap.parent());

          // set text
          infoP.html(distanceTxt + '<br/>' + timeTxt).show();

          // offset time p
          if (timeP.css('top') === infoP.css('top'))
            timeP.css({ top: parseInt(timeP.css('top')) + infoP.height() + 12 });
        },

        hideInfo = function () {
          $('.map-info', wrap.parent()).hide();
        };

    return {

      init: function (fn) {
        // hide wrap
        wrap.hide();

        // plot map
        plot(fn);

        // fade in
        wrap.fadeIn(2000);
      },

      update: function (snappedTime) {

        // check bounds
        if (snappedTime < timeBounds[0] || snappedTime > timeBounds[1]) {

          // find the cycle we want
          for (var i = 0, len = box.cycles.length; i < len; i++) {
            var beg = box.cycles[i].beg, end = box.cycles[i].end;
            if (snappedTime >= beg && end) {
              if (timeBounds[0] !== beg && timeBounds[1] !== end) {

                // refresh map with new time bounds
                loading.show();
                this.clear();
                this.refresh([beg, end]);

                // highlight proper dot in overviewer
                box.overviewer.updateMapped([beg, end]);

              }
              break;
            }
          }
        } else {

          // move cursor
          var ts = snappedTime.valueOf();
          if (ts in gpsPoints)
            cursor.setPosition(gpsPoints[ts]);
        }
      },

      showLoading: function () {
        loading.show();
        hideInfo();
      },

      refresh: function (bounds) {

        // set new bounds
        timeBounds = [ bounds[0] * 1000, bounds[1] * 1000 ];

        // draw new map
        plot(function () { loading.hide(); });
      },

      resize: function (wl, hl, wr, hr) {
        if (!map) return;
        google.maps.event.trigger(map, 'resize');
        if (!wl) wl = mapWidth;
        if (!hl) hl = mapHeight;
        map.panBy((mapWidth - wl) / 2, (mapHeight - hl) / 2);

        mapWidth = wrap.width();
        mapHeight = wrap.height();
      },

      wipe: function () {

        // remove polygons
        poly.setMap(null);
        for (var k = 0, len = dots.length; k < len; k++)
          dots[k].setMap(null);
        for (var k = 0, len = cellDots.length; k < len; k++)
          cellDots[k].setMap(null);
      },

      clear: function () {
        if (!map) return;
        // remove event listeners
        google.maps.event.removeListener(loadedHandle);
        google.maps.event.removeListener(dragHandle);
        google.maps.event.removeListener(leaveHandle);
        this.wipe();
        // nullify
        start.setMap(null);
        end.setMap(null);
        cursor.setMap(null);
        start = null;
        end = null;
        cursor = null;
        poly = null;
        dots = null;
        cellDots = null;
        map = null;
        gpsPoints = null;
        cellPoints = null;
        wrap.empty();
      },

    };
  };


  return {

    /**
     * setup doc
     */

      go: function () {

        ///////// EXTENDS

        // Array Unique
        Array.prototype.unique = function () {
          var r = [];
          o:for (var i = 0, n = this.length; i < n; i++) {
            for (var x = 0, y = r.length; x < y; x++)
              if (r[x] === this[i]) continue o;
            r[r.length] = this[i];
          }
          return r;
        }

        // Array Remove - By John Resig (MIT Licensed)
        Array.prototype.remove = function(from, to) {
          var rest = this.slice((to || from) + 1 || this.length);
          this.length = from < 0 ? this.length + from : from;
          return this.push.apply(this, rest);
        };

        ///////// UTILS

        // determine of object is empty (non-enumerable)
        $.isEmpty = function (o) {
          for (var p in o)
            if (o.hasOwnProperty(p))
              return false;
          return true;
        }

        // server PUT
        $.put = function (url, data, success) {
          data._method = 'PUT';
          $.post(url, data, success, 'json');
        };

        // server GET
        $.get = function (url, data, success) {
          data._method = 'GET';
          $.post(url, data, success, 'json');
        };

        // server DEL
        $.del = function (url, data, success) {
          $.ajax(url, {
            type: 'DELETE',
            data: data,
            success: success,
          });
        };

        // map form data to JSON
        $.fn.serializeObject = function () {
          var o = {},
              a = this.serializeArray();
          $.each(a, function () {
            if (o[this.name]) {
              if (!o[this.name].push)
                o[this.name] = [o[this.name]];
              o[this.name].push(this.value || '');
            } else {
              o[this.name] = this.value || '';
            }
          });
          return o;
        };

        // get database ID
        $.fn.itemID = function () {
          try {
            var items = $(this).attr('id').split('-');
            return items[items.length - 1];
          } catch (exception) {
            return null;
          }
        };


        //////// SETUP


        if (window.location.pathname === '/login') {

          // future info map
          addLandingMap();
        } else {

          // layer tabs
          var tabs = $('.tab');
          tabs.each(function (i) {
            $this = $(this);
            var z = $this.hasClass('tab-active') ?
              10001 + tabs.length - i :
              tabs.length - i;
            $this.css({ zIndex: z });
          });

          // add commas
          $('.number').each(function (i) {
            var $this = $(this);
            $this.text(addCommas($this.text()));
          });

          // fit layout
          sizeDetailPanes();

          // get relative comment times
          setInterval(updateTimes, 5000); updateTimes();
        }


        //////// HANDLERS


        if (window.location.pathname === '/login') {

          

        } else {

          // logout
          $('#logout').live('click', function (e) {
            e.preventDefault();
            var element = $(this)
                form = $('<form></form>');
            form
              .attr({
                method: 'POST',
                action: '/sessions',
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                'name': '_method',
                'value': 'delete',
              })
              .end()
              .submit();
          });

          // click a tab
          tabs.live('click', function () {
            var $this = $(this);
            $('.tab-active').each(function (i) {
              var $this = $(this);
              $this.removeClass('tab-active');
              $this.css({ zIndex: parseInt($this.css('z-index')) - 10001 });
              flipTabSides($this);
              $('.tab-content', $this).addClass('tab-content-inactive');
            });
            $this.addClass('tab-active');
            $this.css({ zIndex: 10001 + parseInt($this.css('z-index')) });
            flipTabSides($this);
            $('.tab-content', $this).removeClass('tab-content-inactive');

            // show and hide content
            var target = $('.' + $this.attr('data-tab-target'));
            if (target.is(":visible")) {
              return;
            }
            $('.tab-target').hide();
            target.show();
          });

          // resize window
          $(window).resize(function () {

            var ww = $(this).width();

            $('.details').each(function (i) {
              var $this = $(this),
                  lp = $($this.children()[0]),
                  cp = $($this.children()[1]),
                  rp = $($this.children()[2]),
                  tpw = lp.width() + cp.width() + rp.width(),
                  dif = (ww - tpw) / 2;

              lp.width(lp.width() + dif);
              rp.width(rp.width() + dif);

              if ($this.data().sandbox) {
                $this.data().sandbox.widgets.forEach(function (w) {
                  w.resize(lp.width(), null, rp.width(), null);
                });
              }

            });
          });

          // resize vertical panes
          $('.details-bar-bottom, img.resize-y').live('mousedown', function (e) {
            var pan = $(this).hasClass('details-bar-bottom') ?
                      $(this.parentNode) : $(this.parentNode.parentNode),
              handle = $('img.resize-x', pan),
              widgets = pan.children().data().sandbox.widgets,
              pan_h_orig = pan.height(),
              mouse_orig = mouse(e);

            // bind mouse move
            var movehandle = function (e) {

              // get mouse position
              var m = mouse(e);

              // determine new values
              var ph = pan_h_orig + (m.y - mouse_orig.y);

              // check bounds
              if (ph < 100 || ph > 800) return false;

              // set height
              pan.height(ph);

              // move handles
              handle.css({ top: ph / 2 - handle.height() });

              // widgets
              for (var w=0; w < widgets.length; w++)
                widgets[w].resize(null, ph - 18, null, ph - 18)
            };

            $(document).bind('mousemove', movehandle);

            // bind mouse up
            $(document).bind('mouseup', function () {

              // remove all
              $(this).unbind('mousemove', movehandle).unbind('mouseup', arguments.callee);
            });
          });


          // resize horizontal panes
          $('.details-bar-middle, img.resize-x').live('mousedown', function (e) {
            var $this = $(this).hasClass('details-bar-middle') ?
                        this : this.parentNode,
              pan_left = $($this.previousElementSibling),
              pan_right = $($this.nextElementSibling),
              parent = $($this.parentNode),
              widgets = parent.data().sandbox.widgets,
              pan_left_w_orig = pan_left.width(),
              pan_right_w_orig = pan_right.width(),
              mouse_orig = mouse(e);

            // bind mouse move
            var movehandle = function (e) {

              // get mouse position
              var m = mouse(e);

              // determine new values
              var plw = pan_left_w_orig + (m.x - mouse_orig.x),
                  prw = pan_right_w_orig - (m.x - mouse_orig.x)

              // check bounds
              if (plw < 200 || prw < 200) return false;

              // set widths
              pan_left.width(plw);
              pan_right.width(prw);

              // widgets
              for (var w=0; w < widgets.length; w++)
                widgets[w].resize(plw, null, prw, null)
            };

            $(document).bind('mousemove', movehandle);

            // bind mouse up
            $(document).bind('mouseup', function () {

              // remove all
              $(this).unbind('mousemove', movehandle).unbind('mouseup', arguments.callee);
            });
          });

          // no image dragging
          $('img.resize-x, img.resize-y, img.resize-slider').live('mousedown', function (e) {
            if (e.preventDefault) e.preventDefault();
          });

          // initial vehicle cycle query
          $('a.expander').live('click', function () {

            var $this = $(this),
              arrow = $('img', $this),
              deetsHolder = $(this.parentNode.parentNode.nextElementSibling),
              deets = $(deetsHolder.children().children()),
              deetsKid = $(deetsHolder.children().children().children()[0]),
              handle = $('img.resize-x', deets);

            if (!arrow.hasClass('open')) {
              arrow.addClass('open');
              deetsHolder.show();
              deets.animate({ height: expandDetailsTo }, 150, 'easeOutExpo', function () {

                var vehicleId = parseInt($this.itemID());
                dnodeInvoke('fetchSamples', ServiceGUI.sessionInfo,
                            vehicleId, '_wake', {}, function(err, cycles) {
                  if (!err) {
                    mergeOverlappingSamples(cycles);
                    var sandbox = new Sandbox(vehicleId, cycles, function () {
                      this.add('Map', $('.map', deetsKid), $('.map-loading', deetsKid), function (empty) {
                        if (empty)
                          $('.map-loading span', deetsKid).text('No map data.');
                        else
                          $('.map-loading', deetsKid).hide();
                      });
                      this.add('TimeSeries', $('.details-right', deetsKid), $('.series-loading', deetsKid), function (empty) {
                        if (empty) {
                          $('.series-loading span', deetsKid).text('No time series data.');
                        } else {
                          $('.series-loading', deetsKid).hide();
                        }
                      });
                      this.add('Overviewer', $('.overviewer', deetsKid), null, function () {});

                      // add sandbox to details div
                      deetsKid.data({ sandbox: this });
                    });
                  } else {
                    console.log(err);
                    $('.map-loading span', deetsKid).text('No map data.');
                    $('.series-loading span', deetsKid).text('No time series data.');
                  }
                });

              });
              handle.animate({ top: (expandDetailsTo / 2) - handle.height() }, 150, 'easeOutExpo');
            } else {

              // hide details
              arrow.removeClass('open');
              deetsHolder.hide();
              deets.css({ height: 20 });

              if (deetsKid.data().sandbox) {

                // clear widgets
                for (var i = 0, len = deetsKid.data().sandbox.widgets.length; i < len; i++) {
                  deetsKid.data().sandbox.widgets[i].clear();
                }
              }

              // delete sandbox
              deetsKid.data().sandbox = null;

              // remove widget elements and show loading text
              $('.details-right', deetsKid).children().each(function (i) {
                if (i > 0)
                  $(this).remove();
                else {
                  $('span', this).text('Loading time series data...');
                  $(this).show();
                }
              });
              $('.details-left', deetsKid).children().each(function (i) {
                if (i === 0) {
                  $('span', this).text('Loading map data...');
                  $(this).show();
                }
              });
            }
          });

          // TMP -- open the first vehicle pane
          // $($('a.expander')[1]).click();
        }
      }
  }
})(jQuery);

