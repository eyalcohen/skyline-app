

ServiceGUI = (function ($) {

  var expandDetailsTo = 500

    , orange = '#ff931a'
    , blue = '#55f5f2'
    , green = '#00f62e'
    , red = '#fe110e'
    , yellow = '#befe11'
    , purple = '#5a1ada'

    , mapStylez = [
          {
            featureType: 'administrative',
            elementType: 'all',
            stylers: [ { visibility: 'off' } ]
          }
        , {
            featureType: 'landscape',
            elementType: 'all',
            stylers: [ { saturation: 100 } ]
          }
        , {
            featureType: 'poi',
            elementType: 'all',
            stylers: [ { saturation: 100 } ]
          }
        , {
            featureType: 'road',
            elementType: 'all',
            stylers: [ { saturation: -100 } ]
          }
        , {
            featureType: 'transit',
            elementType: 'all',
            stylers: [ { visibility: 'off' } ]
          }
        , {
            featureType: 'water',
            elementType: 'all',
            stylers: [ { saturation: -100 } ]
          }
      ]
    , mapStyledOptions = {
        name: 'GrayScale'
      }

    , search = function (by, val, fn) {
        jrid.empty();
        var data = {
              by  : by
            , val : val
          };
        $.get('/search/' + val + '.json', data, fn);
      }

    , mouse = function (e, r) {
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
      }

    , flipTabSides = function (ctx) {
        var sides = $('.tab-side img', ctx);
        sides.each(function (i) {
          var $this = $(this)
            , old = $this.attr('src')
            , noo = $this.attr('alt')
          ;
          $this.attr({ src: noo, alt: old });
        });
      }

    , addCommas = function (n) {
        n += '';
        var x = n.split('.')
          , x1 = x[0]
          , x2 = x.length > 1 ? '.' + x[1] : ''
          , rgx = /(\d+)(\d{3})/
        ;
        while (rgx.test(x1)) {
          x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
      }

    , addLandingMap = function () {
        var wrap = $('#landing-map')
          , chicago = new google.maps.LatLng(39.6,-94.35)
          , map
          , mapOptions = {
                zoom: 4
              , center: chicago
              , disableDefaultUI: true
              , mapTypeControlOptions: {
                  mapTypeIds: [ google.maps.MapTypeId.ROADMAP, 'greyscale' ]
                }
            }
          , mapType = new google.maps.StyledMapType(mapStylez, mapStyledOptions)
        ;

        // make new map
        map = new google.maps.Map(wrap[0], mapOptions);
        map.mapTypes.set('grayscale', mapType);
        map.setMapTypeId('grayscale');

        // ready
        google.maps.event.addListener(map, 'tilesloaded', function () {
          google.maps.event.trigger(map, 'resize');
          wrap.removeClass('map-tmp');
        });
      }

    , sizeDetailPanes = function () {
        var ww = $(window).width()
          , lw = Math.ceil((ww - 9) * 0.3)
          , rw = Math.floor((ww - 9) * 0.7)
        ;
        $('.details-left').width(lw);
        $('.details-right').width(rw);
      }

  /**
   * handle relative time
   */

    , relativeTime = function (ts) {
        ts = parseInt(ts);
        var parsed_date = new Date(ts)
          , relative_to = (arguments.length > 1) ? arguments[1] : new Date()
          , delta = parseInt((relative_to.getTime() - parsed_date) / 1000)
        ;
        if (delta < 5)
          return 'just now';
        else if (delta < 15)
          return 'just a moment ago';
        else if (delta < 30)
          return 'just a few moments ago';
        else if (delta < 60)
          return 'less than a minute ago';
        else if (delta < 120)
          return 'about a minute ago';
        else if (delta < (45 * 60))
          return (parseInt(delta / 60)).toString() + ' minutes ago';
        else if (delta < (90 * 60))
          return 'about an hour ago';
        else if (delta < (24 * 60 * 60)) {
          var h = (parseInt(delta / 3600)).toString();
          if (h != '1')
            return 'about ' + h + ' hours ago';
          else
            return 'about an hour ago';
        }
        else if (delta < (2 * 24 * 60 * 60))
          return 'about a day ago';
        else if (delta < (10 * 24 * 60 * 60))
          return (parseInt(delta / 86400)).toString() + ' days ago';
        else
          return new Date(ts).toLocaleDateString();
      }

    , updateTimes = function () {
        $('[data-last-seen]').each(function (i) {
          var time = $(this);
          if (!time.data('ts'))
            time.data('ts', time.attr('data-last-seen'));
          time.text(relativeTime(time.data('ts')));
        });
      }
  ;

  var Sandbox = function (data, fn) {
    // convert bounds to int
    for (var i = 0, len = data.length; i < len; i++) {
      data[i].bounds.start = parseInt(data[i].bounds.start);
      data[i].bounds.stop = parseInt(data[i].bounds.stop);
    }
    // save raw data
    this.raw = data;
    // plotter and map ref holder
    this.widgets = [];
    // valid series
    this.validSensors = {
        SENSOR_GPS: {
            key: 'location'
          , series: {
                latitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Latitude (deg)' }
                  , labels: [ 'time', '(lat)' ]
                }
              , longitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Longitude (deg)' }
                  , labels: ['time', '(lng)' ]
                }
              , altitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Altitude (m)' }
                  , labels: ['time', '(alt)' ]
                }
              , speed: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Speed (m/s)' }
                  , labels: ['time', '(spd)' ]
                }
            }
        }
      // , SENSOR_CELLPOS: {
      //     key: 'location'
      //   , series: {
      //         latitude: {
      //             dataPoints: []
      //           , cycleStartTimes: []
      //           , cycleEndTimes: []
      //           , titles: { x: 'Time', y: 'Latitude (˚)' }
      //           , labels: [ 'time', '˚' ]
      //         }
      //       , longitude: {
      //             dataPoints: []
      //           , cycleStartTimes: []
      //           , cycleEndTimes: []
      //           , titles: { x: 'Time', y: 'Longitude (˚)' }
      //           , labels: ['time', '˚' ]
      //         }
      //     }
      // }
      , SENSOR_ACCEL: {
            key: 'sensor'
          , names: ['acceleration_x', 'acceleration_y', 'acceleration_z']
          , series: {
                acceleration_x: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Acceleration X (m/s^2)' }
                  , labels: ['time', '(acx)']
                }
              , acceleration_y: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Acceleration Y (m/s^2)' }
                  , labels: ['time', '(acy)']
                }
              , acceleration_z: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Acceleration Z (m/s^2)' }
                  , labels: ['time', '(acz)']
                }
            }
        }
      , SENSOR_COMPASS: {
            key: 'sensor'
          , names: ['compass_x', 'compass_y', 'compass_z']
          , series: {
                compass_x: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Heading X (deg)' }
                  , labels: ['time', '(cpx)']
                }
              , compass_y: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Heading Y (deg)' }
                  , labels: ['time', '(cpy)']
                }
              , compass_x: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , cycleEndTimes: []
                  , titles: { x: 'Time', y: 'Heading Z (deg)' }
                  , labels: ['time', '(cpz)']
                }
            }
        }
    };
    
    // currently available channels
    this.availableChannels = {};
    
    // start with latest cycle only
    this.visibleCycles = [data[data.length - 1]._id];
    this.parseVisibleCycles();

    // callback
    fn.call(this);
  };

  Sandbox.prototype.parseVisibleCycles = function () {

    // only select valid key types
    var data = $.extend(true, {}, this.validSensors)
      , sensors = Object.keys(this.validSensors)
      , cycles = []
    ;

    // get data from ids
    for (var i = 0, leni = this.raw.length; i < leni; i++) {
      for (var j = 0, lenj = this.visibleCycles.length; j < lenj; j++) {
        if (this.raw[i]._id === this.visibleCycles[j]) {
          cycles.push(this.raw[i]);
        }
      }
    }

    // parse data
    for (var i = 0, leni = cycles.length; i < leni; i++) {
      if (!cycles[i].events)
        continue;
      for (var j = 0, lenj = cycles[i].events.length; j < lenj; j++) {
        var event = cycles[i].events[j]
          , source = event.header.source
        ;
        if (source in data) {
          if (data[source].key in event) {
            var key = event[data[source].key]
              , lenk = key.length
              // , time = new Date(parseInt(event.header.startTime))
              , time = parseInt(event.header.startTime)
              , src = event.header.source
            ;
            if (lenk) {
              // is array
              var names = data[source].names;              
              for (var n = 0, lenn = names.length; n < lenn; n++) {
                var series = data[source].series[names[n]]
                  , point = [time, key[n]]
                ;
                // add to series
                series.dataPoints.push(point);
                // check if first
                if (series.cycleStartTimes.length === i)
                  series.cycleStartTimes.push(time);
                // update last
                series.cycleEndTimes[i] = time;
              }
              
              // var name = data[source].name
              //   , series = data[source].series[name]
              //   , point = []
              // ;
              // point.push(time);
              // for (var k = 0; k < lenk; k++)
              //   point.push(key[k]);
              // // add to series
              // series.dataPoints.push(point);
              // // check if first
              // if (series.cycleStartTimes.length === i)
              //   series.cycleStartTimes.push(time);
              // // update last
              // series.cycleEndTimes[i] = time;
            } else {
              // is object
              for (var k in key) {
                var series = data[source].series[k];
                if (key.hasOwnProperty(k) && series) {
                  var point = [time, key[k]];
                  // add to series
                  series.dataPoints.push(point);
                  // check if first
                  if (series.cycleStartTimes.length === i)
                    series.cycleStartTimes.push(time);
                  // update last
                  series.cycleEndTimes[i] = time;
                }
              }
            }
          }
        }
      }
    }
    
    // update available channels
    this.availableChannels = {};
    for (var sensor in data)
      if (data.hasOwnProperty(sensor)) {
        this.availableChannels[sensor] = [];
        for (var s in data[sensor].series)
          if (data[sensor].series.hasOwnProperty(s))
            if (data[sensor].series[s].dataPoints.length > 0)
              this.availableChannels[sensor].push(s);
      }

    // done
    this.visibleSensors = data;

    // log for now
    // console.log(data);
  };

  Sandbox.prototype.add = function (type, wrap, loading, fn) {
    switch (type) {
      case 'Map':
        this.map = new Map(this, wrap, loading);
        this.widgets.push(this.map);
        this.map.init(fn);
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

  Sandbox.prototype.reEvaluateData = function (params, fn) {

    var self = this
      , min = params.range[0]
      , max = params.range[1]
      , visibleAndEmpty = []
      , redraw = false
    ;
    
    // check window bounds
    for (var i = 0, leni = self.raw.length; i < leni; i++) {
      var index;
      if ((self.raw[i].bounds.start >= min && self.raw[i].bounds.start <= max) ||
          (self.raw[i].bounds.stop >= min && self.raw[i].bounds.stop <= max)
      ) {
        if (self.visibleCycles.indexOf(self.raw[i]._id) === -1) {
          visibleAndEmpty.push(self.raw[i]._id);
          self.visibleCycles.push(self.raw[i]._id);
        }
      } 
      
      if ((self.raw[i].bounds.start > max || self.raw[i].bounds.stop < min) &&
        (index = self.visibleCycles.indexOf(self.raw[i]._id)) !== -1 &&
        self.visibleCycles.length > 1
      ) {
        delete self.raw[i].events;
        self.visibleCycles.splice(index, 1);
        redraw = true;
      }
    }

    // get new data
    if (visibleAndEmpty.length > 0) {
      
      // show loading for this chart
      this.timeseries.showLoading();
      
      // call server
      $.get('/cycles', { cycles: visibleAndEmpty }, function (serv) {
        if (serv.status == 'success') {
          for (var i = 0, len = self.raw.length; i < len; i++) {
            if (self.raw[i]._id in serv.data.events) {
              if (serv.data.events[self.raw[i]._id]) {
                self.raw[i].events = serv.data.events[self.raw[i]._id];
              } else {
                var rem = self.visibleCycles.indexOf(self.raw[i]._id);
                self.visibleCycles.splice(rem, 1);
                self.raw[i] = null;
              }
            }
          }
          self.raw = self.raw.filter(function (e) { return e; });
          self.parseVisibleCycles();
          fn(true);
        } else {
          console.log(serv.data.code);
          fn(false);
        }
      });
    } else if (redraw) {
      self.parseVisibleCycles();
      fn(true);
    } else
      fn(false);
  };

  var TimeSeries = function (box, wrap) {
    var defaultSeries = ['speed', 'altitude']
      , charts = []
      , plotColors = [orange, blue, green, red, yellow, purple]
      , blockRedraw = false
      , overviewHeight = $('.overviewer', wrap).height() + 5

      , makeChart = function (params) {

          var chart = new Dygraph(wrap[0], params.points, {
              width: wrap.width()
            , height: (wrap.height() - (5 * (params.of - 1)) - overviewHeight) / params.of
            , index: params.index
            , of: params.of
            , channels: box.availableChannels
            , key: params.key
            , sensor: params.sensor
            , rightGap: 0
            , fillGraph: true
            , fillAlpha: 0.05
            , gridLineColor: 'rgba(255,255,255,0.25)'
            // , colors: params.colors
            , colorOne: orange
            , colorTwo: '#ffffff'
            , strokeWidth: 0.5
            , labels: params.plot.labels
            , axisLineColor: 'rgba(0,0,0,0)'
            , axisLabelColor: '#808080'
            , axisLabelFontSize: 9
            , xlabel: params.plot.titles.x
            , ylabel: params.plot.titles.y
            , stepPlot: true
            , starts: params.plot.cycleStartTimes
            , plot: params.plot

            , interactionModel : {
                  mousedown: downV3
                , mousemove: moveV3
                , mouseup: upV3
                , click: clickV3
                , dblclick: dblClickV4
                , mousewheel: scrollV3
                , DOMMouseScroll: scrollV3
              }

            , highlightCallback: function(e, x, pts, row) {

                // notify sandbox
                box.notify('cs-point-hover', {
                  time: new Date(x)
                });
              }

            , drawCallback: function (me, initial) {
                if (initial) return;

                // get new date window
                var range = me.xAxisRange()
                  , yrange = me.yAxisRange()
                ;

                // notify sandbox
                box.notify('cs-time-window-change', {
                  range: range
                }, function (redraw) {

                  if (charts.length < me.of || blockRedraw)
                    return;

                  blockRedraw = true;

                  if (redraw) {
                    for (var i = 0, len = charts.length; i < len; i++) {
                      var sen = box.visibleSensors[charts[i].sensor]
                        , ser = sen.series[charts[i].key]
                      ;
                      if (charts[i].key2) {
                        var sen2 = box.visibleSensors[charts[i].sensor2]
                          , ser2 = sen2.series[charts[i].key2]
                        ;
                        var combinedDataSet = combineSeries(ser.dataPoints, ser2.dataPoints);
                        charts[i].updateOptions({
                            file: combinedDataSet
                          , starts: ser.cycleStartTimes.concat(ser2.cycleStartTimes)
                          , dateWindow: range
                        }, true);                  
                      } else {
                        charts[i].updateOptions({
                            file: ser.dataPoints
                          , starts: ser.cycleStartTimes
                          , dateWindow: range
                        }, true);
                      }
                    }
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

        }

      , bindRightClickMenu = function (self) {
          $('canvas').not('.overviewer-canvas').contextMenu('context-menu-1', { 
              'Insert Plot Below...': {
                click: function (el) {
                  var i = el.itemID()
                    , chart = charts[i]
                  ;

                  // make a new dygraph
                  var newChart = makeChart({
                      points: box.visibleSensors.SENSOR_GPS.series.speed.dataPoints
                    , of: chart.of + 1
                    , index: chart.index + 1
                    , self: self
                    , key: 'speed'
                    , sensor: 'SENSOR_GPS'
                    , plot: box.visibleSensors.SENSOR_GPS.series.speed
                  });
                  
                  // collect it for later
                  charts.splice(i, 0, newChart);
                  
                  // update other charts
                  for (var j = 0, len = charts.length; j < len; j++) {
                    charts[j].updateOptions({
                        of: len
                      , index: j
                      , siblings: charts
                    }, true);
                  }
                  
                  // resize container
                  self.resize();
                }
              }
              , 'Delete': {
                click: function (el) {
                  var i = el.itemID();
                  
                  // kill it
                  charts[i].destroy();
                  
                  // remove index in list
                  charts.splice(i, 1);
                  
                  // update other charts
                  for (var j = 0, len = charts.length; j < len; j++) {
                    charts[j].updateOptions({
                        of: len
                      , index: j
                    }, true);
                  }
                  
                  // resize container
                  self.resize();
                }
              }
            }
            , {
                showMenu: function() {}
              , hideMenu: function() {}
            }
          );
        }

      , showLoading = function () {
          $('.loading-more', wrap).show()
        }

      , hideLoading = function () {
          $('.loading-more', wrap).hide();
        }

      , combineSeries = function (s1, s2) {
          var combined = []
            , times = []
            , s1o = {}
            , s2o = {}
          ;
          // create list of all times
          for (var i = 0, len = Math.max(s1.length, s2.length); i < len; i++) {
            var t1 = s1[i][0] || null
              , t2 = s2[i][0] || null
            ;
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
            var t = times[i]
              , p = [t]
            ;
            if (s1o[t])
              p.push(s1o[t]);
            else
              p.push(NaN);
            if (s2o[t])
              p.push(s2o[t]);
            else
              p.push(NaN);

            combined.push(p);
          }
          
          // return the combined dataset
          return combined;

        }
    ;

    return {
      
        init: function (fn) {
          // check data existence
          if (!box.visibleSensors) {
            fn(true);
            return;
          }

          // plot it
          this.plot(fn);

          // channel selects
          var self = this;
          $('select').live('change', function () {
            var $this
              , clear
            ;
            if ($(this).val() !== 'choose') {
              $this = $(this);
            } else {
              clear = true;
              $this = $('select', this.parentNode.parentNode.previousElementSibling);
            }

            var chart = charts[$this.parent().itemID()]
              , key = $this.val()
              , sensor = $(':selected', $this).attr('class')
              , series = box.visibleSensors[sensor].series[key]
              , $sibling = $this.hasClass('select1') ?
                  $('select', this.parentNode.parentNode.nextElementSibling) :
                  $('select', this.parentNode.parentNode.previousElementSibling)
              , siblingKey = $sibling.val()
            ;

            if (siblingKey !== 'choose' && !clear) {

              var siblingSensor = $(':selected', $sibling).attr('class')
                , siblingSeries = box.visibleSensors[siblingSensor].series[siblingKey]
              ;

              var seriesOne
                , seriesTwo
                , setOne
                , setTwo
                , keyOne
                , keyTwo
                , sensorOne
                , sensorTwo
              ;

              if ($this.hasClass('select1')) {
                seriesOne = series;
                seriesTwo = siblingSeries;
                setOne = series.dataPoints;
                setTwo = siblingSeries.dataPoints;
                keyOne = key;
                keyTwo = siblingKey;
                sensorOne = sensor;
                sensorTwo = siblingSensor;
              } else {
                seriesOne = siblingSeries;
                seriesTwo = series;
                setOne = siblingSeries.dataPoints;
                setTwo = series.dataPoints;
                keyOne = siblingKey;
                keyTwo = key;
                sensorOne = siblingSensor;
                sensorTwo = sensor;
              }

              // create list of all times
              var combinedDataSet = combineSeries(setOne, setTwo);

              // update chart
              chart.updateOptions({
                  file: combinedDataSet
                , starts: seriesOne.cycleStartTimes.concat(seriesTwo.cycleStartTimes)
                , sensor: sensorOne
                , sensor2: sensorTwo
                , key: keyOne
                , key2: keyTwo
                , labels: [seriesOne.labels[0], seriesOne.labels[1], seriesTwo.labels[1]]
                , xlabel: seriesOne.titles.x
                , ylabel: seriesOne.titles.y
                , ylabel2: seriesTwo.titles.y
              }, true);
              
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
              $('select').sb('refresh');
              
            } else {

              // update chart
              chart.updateOptions({
                  file: series.dataPoints
                , starts: series.cycleStartTimes
                , sensor: sensor
                , sensor2: null
                , key: key
                , key2: null
                , labels: series.labels
                , xlabel: series.titles.x
                , ylabel: series.titles.y
                , ylabel2: null
              }, true);

            }
              
          });

          // init right clicks
          bindRightClickMenu(self);
        }

      , plot: function (desiredSeries, fn) {

          // save this scope
          var self = this
            , sensors = box.visibleSensors
            , numColors = plotColors.length
            , colorCnt = 0
          ;
          if (!fn) {
            fn = desiredSeries;
            desiredSeries = defaultSeries;
          }

          // create each chart
          for (var s in sensors) {
            if (sensors.hasOwnProperty(s)) {
              var series = sensors[s].series;
              for (var i = 0, len = desiredSeries.length; i < len; i++) {
                if (desiredSeries[i] in series) {
                  var plot = series[desiredSeries[i]]
                    , points = plot.dataPoints.length !== 0 ? plot.dataPoints : null
                    , colors = []
                  ;

                  // get colors
                  if (points && points[0].length > 2) {
                    for (var c = colorCnt, lenc = plotColors.length; c < lenc; c++) {
                      colors.push(plotColors[c]);
                    }
                  } else
                    colors.push(plotColors[colorCnt]);
                  colorCnt++;

                  // make a new dygraph
                  var chart = makeChart({
                      points: points
                    , of: len
                    , index: i
                    , self: self
                    , key: desiredSeries[i]
                    , colors: colors
                    , sensor: s
                    , plot: plot
                  });

                  // collect it for later
                  charts.push(chart);
                }
              }
            }
          }

          // get widest range
          var maxRange = []
            , maxRangeDiff = 0
          ;
          for (var i = 0, len = charts.length; i < len; i++) {
            var r = charts[i].xAxisRange()
              , d = r[1] - r[0]
            ;
            if (d > maxRangeDiff) {
              maxRangeDiff = d;
              maxRange = r;
            }
          }

          // add siblings ref and snap to widest range
          for (var i = 0; i < len; i++) {
            charts[i].updateOptions({
                siblings: charts
              , dateWindow: maxRange
            }, true);
          }

          // init the dropdowns
          $('select').sb({
              fixedWidth: true
            , animDuration: 50
          });

          // add class names to color picker
          $('.colors').each(function (i) {
            if (i % 2 == 0)
              $(this).addClass('for-plot-one');
            else
               $(this).addClass('for-plot-two');
          });

          // init color picker
          $('.colors').miniColors({
            change: function(hex, rgb) {
              var $this = $(this)
                , chart = charts[$this.itemID()]
                , colorOne
              ;

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
          $('.miniColors-trigger').each(function (i) {
            var color = $(this.parentNode).attr('class').split(' ')[1].split('-')[1];
            $(this).css({ backgroundColor: color });
          });

          // callback
          fn();
        }

      , snap: function (range, fn) {

          // notify sandbox
          box.notify('cs-time-window-change', {
            range: range
          , skipOverview: true
          }, function (redraw) {

            // update plots with new data
            if (redraw) {
              for (var i = 0, len = charts.length; i < len; i++) {
                var sen = box.visibleSensors[charts[i].sensor]
                  , ser = sen.series[charts[i].key]
                ;
                if (charts[i].key2) {
                  var sen2 = box.visibleSensors[charts[i].sensor2]
                    , ser2 = sen2.series[charts[i].key2]
                  ;
                  var combinedDataSet = combineSeries(ser.dataPoints, ser2.dataPoints);
                  charts[i].updateOptions({
                      file: combinedDataSet
                    , starts: ser.cycleStartTimes.concat(ser2.cycleStartTimes)
                    , dateWindow: range
                  }, true);                  
                } else {
                  charts[i].updateOptions({
                      file: ser.dataPoints
                    , starts: ser.cycleStartTimes
                    , dateWindow: range
                  }, true);
                }
              }
            }
            
            hideLoading();
            fn();
          });
        }
        
      , resize: function (wl, hl, wr, hr) {
          var self = this;
        
          if (!wr)
            wr = wrap.width();
          if (!hr)
            hr = wrap.height();
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].resize(wr, (hr - (5 * (len - 1)) - overviewHeight) / len);
          }
          
          // init the dropdowns
          $('select').sb({
              fixedWidth: true
            , animDuration: 50
          });
          
          // add class names to color picker
          $('.colors').each(function (i) {
            if (i % 2 == 0)
              $(this).addClass('for-plot-one');
            else
               $(this).addClass('for-plot-two');
          });

          // init color picker
          $('.colors').miniColors({
            change: function(hex, rgb) {
              var $this = $(this)
                , chart = charts[$this.itemID()]
                , colorOne
              ;

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
          $('.miniColors-trigger').each(function (i) {
            var color = $(this.parentNode).attr('class').split(' ')[1].split('-')[1];
            $(this).css({ backgroundColor: color });
          });
          
          // init right clicks
          bindRightClickMenu(self);
        }
      , update: function (time) {
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].highlight_(time);
          }
        }
      , showLoading: showLoading
      , getChart: function (index) {
          return charts[index];
        }
      , clearSelection: function () {
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].clearSelection();
          }
        }
      , clear: function () {
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].destroy();
          }
        }
    };
  };


  var Overviewer = function (box, wrap) {
    var width = wrap.width()
      , height = wrap.height()
      , slider = $('.overviewer-slider')
      , dotsCanvas = $('<canvas class="overviewer-canvas" width="' + width + '" height="' + height + '"></canvas>')
      , dragCanvas = $('<canvas class="overviewer-canvas" width="' + width + '" height="' + height + '"></canvas>')
      , dotsCtx = dotsCanvas[0].getContext('2d')
      , dragCtx = dragCanvas[0].getContext('2d')
      , bounds = {}
      , padding
      , dots = []
      , scale
      , dragBounds = []
      , visibleDots = []
      , mappedDot

      , updateDots = function () {
          
          // clear canvas
          dotsCtx.clearRect(0, 0, width, height);

          // reset dots
          for (var i = 0, len = dots.length; i < len; i++) {
            var dot = dots[i];
            dot.color = '#ffffff';
            dot.screenX = msToPx(dot.time);
          }
        }
      
      , renderDots = function () {
          for (var i = 0, len = dots.length; i < len; i++) {
            dots[i].draw(dotsCtx);
          }
        }
        
      , clearDrag = function () {

          // clear canvas
          dragCtx.clearRect(0, 0, width, height);
        }

      , renderDrag = function () {
          
          // draw select box
          dragCtx.fillRect(dragBounds[0], 0, dragBounds[1] - dragBounds[0], height);
        }

        // time to pixel mapping
      , msToPx = function (ms) {
          return ms * scale - scale * bounds.start;
        }

        // pixel to time mapping
      , pxToMs = function (px) {
          return parseInt((px + scale * bounds.start) / scale);
        }

        // force graphics to half-pixels
      , crisper = function (v) {
          return Math.round(v) + 0.5;
        }

      , setMappedDot = function (dot) {
          mappedDot = dot;
          mappedDot.color = green;
        }
    ;

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
          bounds.start = box.raw[0].bounds.start;
          bounds.stop = box.raw[box.raw.length - 1].bounds.stop;

          // padding will be 2% or total time shown
          padding = 0.02 * (bounds.stop - bounds.start);
          
          // include padding
          bounds.start -= padding;
          bounds.stop += padding;
          
          // determine ms / px
          scale = width / (bounds.stop - bounds.start);
          
          // plot cylces
          for (var i = 0, len = box.raw.length; i < len; i++) {
            var dot = new Dot(box.raw[i]._id);
            dot.range = [box.raw[i].bounds.start, box.raw[i].bounds.stop];
            dot.time = Math.round((box.raw[i].bounds.stop + box.raw[i].bounds.start) / 2);
            dot.screenX = msToPx(dot.time);
            //dot.radius = scale * (box.raw[i].bounds.stop - box.raw[i].bounds.start) / (bounds.stop - bounds.start);
            dots.push(dot);
            if (i === len - 1)
              setMappedDot(dot);
            dot.draw(dotsCtx);
          }
          
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
                box.map.showLoading();
                box.timeseries.snap(dot.range, function () {
                  box.map.clear();
                  box.map.refresh(dot.range);
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
              box.map.showLoading();
              box.timeseries.snap(range, function () {
                box.map.clear();
                box.map.refresh(dot.range);
              });
              
            });
          });

        }

      , update: function (windowBounds) {

          // clear visible
          visibleDots = [];

          // clear all
          updateDots();

          // find dots
          for (var i = 0, len = dots.length; i < len; i++) {
            var dot = dots[i];
            if (windowBounds[0] < dot.range[1] && 
                windowBounds[1] > dot.range[0]
            ) {

                // highlight
                dot.color = orange;
                visibleDots.push(dot);

            }
          }

          // recolor mapped dot
          mappedDot.color = green;

          // redraw
          renderDots();

        }

      , updateMapped: function (mappedBounds) {
          
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
                mappedBounds[1] > dots[i].time
            ) {

              // color this one green
              setMappedDot(dots[i]);

            }
          }

          // redraw
          renderDots();

        }

      , resize: function (wl, hl, wr, hr) {
          
          // get width again
          width = wrap.width();
          
          // redo scale
          scale = width / (bounds.stop - bounds.start);
          
          // size canvases
          dotsCanvas.attr('width', width);
          dragCanvas.attr('width', width);
          
          // redraw
          updateDots();
          renderDots();
          
        }

      , clear: function () {

        }
    };
  };


  var Dot = function (id) {
    return {
        id: id
      , range: null
      , time: null
      , mapped: false
      , screenX: null
      , screenY: 10
      , color: '#ffffff'
      , opacity: 0.5
      , radius: 5
      , draw: function (ctx) {
          ctx.fillStyle = this.color;
          ctx.globalAlpha = this.opacity;
          ctx.beginPath();
          ctx.arc(this.screenX, this.screenY, this.radius, 0, 2 * Math.PI);
          ctx.fill();
        }
    };
  };


  var Map = function (box, wrap, loading) {
    var gpsPoints
      , timeBounds
      , cellPoints
      , times
      , map
      , mapWidth
      , mapHeight
      , mapOptions
      , mapType
      , poly
      , distance
      , dots
      , cellDots
      , dotStyle
      , cellDotStyle
      , start
      , end
      , cursor
      , firstRun
      , loadedHandle
      , dragHandle
      , leaveHandle

      , refreshVars = function () {
          gpsPoints = {};
          cellPoints = {};
          times = [];
          mapWidth = wrap.width();
          mapHeight = wrap.height();
          mapOptions = {
              disableDefaultUI: true
            , mapTypeControlOptions: {
                mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'greyscale']
              }
          };
          mapType = new google.maps.StyledMapType(mapStylez, mapStyledOptions);
          poly = new google.maps.Polyline({
              strokeColor: '#000000'
            , strokeOpacity: 0.6
            , strokeWeight: 8
            , clickable: false
          });
          dots = [];
          cellDots = [];
          dotStyle = {
              strokeWeight: 0
            , fillColor: "#ffffff"
            , fillOpacity: 0.5
            , radius: 10
            , clickable: false
          };
          cellDotStyle = {
              strokeWeight: 0
            , fillColor: "#ff00ff"
            , fillOpacity: 0.5
            , radius: 50
            , clickable: false
          };
          firstRun = true;
        }

      , plot = function (fn) {
          
          // inits
          var src = box.visibleSensors.SENSOR_GPS.series
            , len = src.latitude.dataPoints.length
          ;

          // exit if nothing to do
          if (src.latitude.dataPoints.length === 0) {
            fn(true);
            return;
          }

          // init data points time boundary
          if (!timeBounds)
            timeBounds = [src.latitude.cycleStartTimes[0], src.latitude.cycleEndTimes[0]];
          
          // clear for new map
          refreshVars();
          
          // poly bounds
          var minlat = 90
            , maxlat = -90
            , minlawn = 180
            , maxlawn = -180
          ;
          
          // built poly
          for (var i = 0; i < len; i++) {
            var time = src.latitude.dataPoints[i][0];
            if (time >= timeBounds[0] && time <= timeBounds[1]) {
              var lat = src.latitude.dataPoints[i][1]
                , lawn = src.longitude.dataPoints[i][1]
              ;
              if (lat < minlat)
                minlat = lat;
              if (lat > maxlat)
                maxlat = lat;
              if (lawn < minlawn)
                minlawn = lawn;
              if (lawn > maxlawn)
                maxlawn = lawn;
              var ll = new google.maps.LatLng(lat, lawn);
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
          var sw = new google.maps.LatLng(minlat, minlawn)
            , ne = new google.maps.LatLng(maxlat, maxlawn)
            , mapBounds = new google.maps.LatLngBounds(sw, ne)
          ;

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
              map: map
            , animation: google.maps.Animation.DROP
            , position: poly.getPath().getAt(0)
            , icon: 'http://google-maps-icons.googlecode.com/files/car.png'
            , zIndex: 1000001
            , clickable: false
          });

          // endpoints
          var imageA = new google.maps.MarkerImage("/graphics/black_MarkerA.png",
              new google.maps.Size(20.0, 34.0),
              new google.maps.Point(0, 0),
              new google.maps.Point(10.0, 34.0)
          );
          var imageB = new google.maps.MarkerImage("/graphics/black_MarkerB.png",
              new google.maps.Size(20.0, 34.0),
              new google.maps.Point(0, 0),
              new google.maps.Point(10.0, 34.0)
          );
          var shadow = new google.maps.MarkerImage("graphics/marker-shadow.png",
              new google.maps.Size(38.0, 34.0),
              new google.maps.Point(0, 0),
              new google.maps.Point(10.0, 34.0)
          );
          start = new google.maps.Marker({
              map: map
            , animation: google.maps.Animation.DROP
            , position: poly.getPath().getAt(0)
            , icon: imageA
            , shadow: shadow
            , clickable: false
          });
          end = new google.maps.Marker({
              map: map
            , animation: google.maps.Animation.DROP
            , position: poly.getPath().getAt(poly.getPath().getLength() - 1)
            , icon: imageB
            , shadow: shadow
            , clickable: false
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
            var minDist = 1e+100
              , snapTo
              , keys = Object.keys(e.latLng)
            ;
            
            // find closest point
            times.forEach(function (t) {
              
              // compute distances
              var deltaLat = Math.abs(gpsPoints[t][keys[0]] - e.latLng[keys[0]])
                , deltaLawn = Math.abs(gpsPoints[t][keys[1]] - e.latLng[keys[1]])
                , dist = Math.sqrt((deltaLat * deltaLat) + (deltaLawn * deltaLawn))
              ;

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
            var timeTxt = (new Date(snapTo.time)).toLocaleString();
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
        }

      , toMiles = function (m) {
          return m / 1609.344;
        }
        
      , showInfo = function () {
          var distanceTxt = 'Distance traveled: ' + addCommas(distance.toFixed(2)) + ' m'
            , timeTxt = 'Cycle duration: ' + addCommas(((parseInt(times[times.length - 1]) - parseInt(times[0])) / 1000 / 60).toFixed(2)) + ' min'
            , infoP = $('.map-info', wrap.parent())
            , timeP = $('.map-time', wrap.parent())
          ;
          
          // set text
          infoP.html(distanceTxt + '<br/>' + timeTxt).show();
          
          // offset time p
          if (timeP.css('top') === infoP.css('top'))
            timeP.css({ top: parseInt(timeP.css('top')) + infoP.height() + 12 });
        }
      , hideInfo = function () {
          $('.map-info', wrap.parent()).hide();
        }
    ;

    return {
        init: function (fn) {
          // hide wrap
          wrap.hide();

          // plot map
          plot(fn);

          // fade in
          wrap.fadeIn(2000);
        }
        
      , update: function (snappedTime) {
          
          // check bounds
          if (snappedTime < timeBounds[0] || snappedTime > timeBounds[1]) {

            // get time bounds for all cycles
            var starts = box.visibleSensors.SENSOR_GPS.series.latitude.cycleStartTimes
              , ends = box.visibleSensors.SENSOR_GPS.series.latitude.cycleEndTimes
            
            // find the cycle we want
            for (var i = 0, len = starts.length; i < len; i++) {
              if (snappedTime >= starts[i] && snappedTime <= ends[i]) {
                if (timeBounds[0] !== starts[i] && timeBounds[1] !== ends[i]) {
                  
                  // refresh map with new time bounds
                  loading.show();
                  this.clear();
                  this.refresh([starts[i], ends[i]]);
                  
                  // highlight proper dot in overviewer
                  box.overviewer.updateMapped([starts[i], ends[i]]);
                  
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
        }
      
      , showLoading: function () {
          loading.show();
          hideInfo();
        }
      
      , refresh: function (bounds) {
          
          // set new bounds
          timeBounds = bounds;

          // draw new map
          plot(function () {
            loading.hide();
          });
        }
        
      , resize: function (wl, hl, wr, hr) {
          if (!map)
            return;
          google.maps.event.trigger(map, 'resize');
          if (!wl)
            wl = mapWidth;
          if (!hl)
            hl = mapHeight;
          map.panBy((mapWidth - wl) / 2, (mapHeight - hl) / 2);

          mapWidth = wrap.width();
          mapHeight = wrap.height();
        }
        
      , wipe: function () {
        
          // remove polygons
          poly.setMap(null);
          for (var k = 0, len = dots.length; k < len; k++)
            dots[k].setMap(null);
          for (var k = 0, len = cellDots.length; k < len; k++)
            cellDots[k].setMap(null);
        }
        
      , clear: function () {
          if (!map)
            return;
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
        }
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
            for (var x = 0, y = r.length; x < y; x++) {
              if (r[x] === this[i]) {
                continue o;
              }
            }
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
              type: 'DELETE'
            , data: data
            , success: success
          });
        };

        // map form data to JSON
        $.fn.serializeObject = function () {
          var o = {}
            , a = this.serializeArray()
          ;
          $.each(a, function () {
            if (o[this.name]) {
              if (!o[this.name].push)
                o[this.name] = [o[this.name]];
              o[this.name].push(this.value || '');
            } else
              o[this.name] = this.value || '';
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
              tabs.length - i
            ;
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

          // landing page login
          var loginForm = $('#login-form')

          // login user
            , loginButton = $('#login')
            , loginEmail = $('input[name="user[email]"]')
            , loginPassword = $('input[name="user[password]"]')
            , loginEmailLabel = $('label[for="user[email]"]')
            , loginPasswordLabel = $('label[for="user[password]"]')

          // reports
            , landingMessage = $('#landing-message')
            , landingSuccess = $('#landing-success')
            , landingError = $('#landing-error')
            , landingSuccessText = $('#landing-success p')
            , landingErrorText = $('#landing-error p')

          // form control
            , exitLoginButton = function () {
                loginButton.removeClass('cs-button-alert');
                resetLoginStyles();
              }
            , resetLoginStyles = function () {
                loginEmailLabel.css('color', '#ccc');
                loginPasswordLabel.css('color', '#ccc');
              }
            , checkInput = function () {
                if (this.value.trim() != '') {
                  $(this).removeClass('cs-input-alert');
                }
              }
          ;
          loginEmail.focus();

          loginButton.bind('mouseenter', function () {
            var email = loginEmail.val().trim()
              , password = loginPassword.val().trim()
            ;
            if (email != '' && password != '') {
              resetLoginStyles();
            } else {
              loginButton.addClass('cs-button-alert');
              if (email == '')
                loginEmailLabel.css('color', 'red');
              if (password == '')
                loginPasswordLabel.css('color', 'red');
            }
          }).bind('mouseleave', exitLoginButton);

          loginEmail.bind('keyup', checkInput);
          loginPassword.bind('keyup', checkInput);

          loginButton.bind('click', function (e) {
            e.preventDefault();
            landingError.hide();
            var data = loginForm.serializeObject();
            $.post('/sessions', data, function (serv) {
              if (serv.status == 'success') {
                window.location = '/';
              } else if (serv.status == 'fail') {
                landingErrorText.html(serv.data.message);
                landingError.fadeIn('fast');
                switch (serv.data.code) {
                  case 'MISSING_FIELD':
                    var missing = serv.data.missing;
                    for (var i=0; i < missing.length; i++) {
                      $('input[name="user[' + missing[i] + ']"]').addClass('cs-input-alert');
                    }
                    break;
                  case 'BAD_AUTH':
                    loginPassword.val('').focus();
                    break;
                  case 'NOT_CONFIRMED':
                    break;
                }
              } else if (serv.status == 'error') {
                landingErrorText.html(serv.message);
                landingError.fadeIn('fast');
              }
            }, 'json');
          });




          /////////////////////////////// API TESTING

          $('.landing-logo').bind('click', function (e) {
            //e.preventDefault();
            //makeUser(this);
            //makeVehicle(this);
            //getUser(this);
            //getVehicle(this);
          });

          function makeUser(self) {
            var element = $(self)
              , form = $('<form></form>')
            ;
            form
              .attr({
                  method: 'POST'
                , action: '/usercreate/vc.c2s.mm@gmail.com'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': 'password'
                , 'value': 'admin'
              });

              form
              .append('<input type="hidden" />')
              .find('input:last-child')
              .attr({
                  'name': 'fullName'
                , 'value': 'Jon Doe'
              })
              .end()
              .submit();
          }

          function makeVehicle(self) {
            var element = $(self)
              , form = $('<form></form>')
            ;
            form
              .attr({
                  method: 'POST'
                , action: '/vehiclecreate/sander@ridemission.com/Honda/Prius/2011'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': 'password'
                , 'value': 'plebeian'
              })
              .end()
              .submit();
          }

          function getUser(self) {
            var element = $(self)
              , form = $('<form></form>')
            ;
            form
              .attr({
                  method: 'GET'
                , action: '/userinfo/sander@island.io'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': 'password'
                , 'value': 'plebeian'
              })
              .end()
              .submit();
          }

          function getVehicle(self) {
            var element = $(self)
              , form = $('<form></form>')
            ;
            form
              .attr({
                  method: 'GET'
                , action: '/summary/sander@ridemission.com/2031952580'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': 'password'
                , 'value': 'plebeian'
              })
              .end()
              .submit();
          }

          /////////////////////////////// API TESTING

        } else {

          // logout
          $('#logout').live('click', function (e) {
            e.preventDefault();
            var element = $(this)
              , form = $('<form></form>')
            ;
            form
              .attr({
                  method: 'POST'
                , action: '/sessions'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': '_method'
                , 'value': 'delete'
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
              var $this = $(this)
                , lp = $($this.children()[0])
                , cp = $($this.children()[1])
                , rp = $($this.children()[2])
                , tpw = lp.width() + cp.width() + rp.width()
                , dif = (ww - tpw) / 2
              ;
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
                $(this.parentNode) :
                $(this.parentNode.parentNode)
              , handle = $('img.resize-x', pan)
              , widgets = pan.children().data().sandbox.widgets
              , pan_h_orig = pan.height()
              , mouse_orig = mouse(e)
            ;

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
                  this : this.parentNode
              , pan_left = $($this.previousElementSibling)
              , pan_right = $($this.nextElementSibling)
              , parent = $($this.parentNode)
              , widgets = parent.data().sandbox.widgets
              , pan_left_w_orig = pan_left.width()
              , pan_right_w_orig = pan_right.width()
              , mouse_orig = mouse(e)
            ;
            
            // bind mouse move
            var movehandle = function (e) {
              
              // get mouse position
              var m = mouse(e);
              
              // determine new values
              var plw = pan_left_w_orig + (m.x - mouse_orig.x)
                , prw = pan_right_w_orig - (m.x - mouse_orig.x)
              
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
            var $this = $(this)
              , arrow = $('img', $this)
              , deetsHolder = $(this.parentNode.parentNode.nextElementSibling)
              , deets = $(deetsHolder.children().children())
              , deetsKid = $(deetsHolder.children().children().children()[0])
              , handle = $('img.resize-x', deets)
            ;
            if (!arrow.hasClass('open')) {
              arrow.addClass('open');
              deetsHolder.show();
              deets.animate({ height: expandDetailsTo }, 150, 'easeOutExpo', function () {
                $.get('/v/' + $this.itemID(), { id: $this.itemID() }, function (serv) {
                  if (serv.status == 'success') {
                    var sandbox = new Sandbox(serv.data.bucks, function () {
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
                    console.log(serv.data.code);
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
          // $($('a.expander')[0]).click();
        }
      }
  }
})(jQuery);

