

Stub = (function ($) {

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
        if ( ! e ) 
          var e = window.event;
        if ( e.pageX || e.pageY ) {
          px = e.pageX;
          py = e.pageY;
        } else if ( e.clientX || e.clientY ) {
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
          , lw = (ww - 10) * 0.3
          , rw = (ww - 10) * 0.7
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
          return
            new Date(ts).toLocaleDateString();
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
    // used to ref cycle on map
    this.activeCycle = null;
    // valid data keys
    this.validKeys = ['sensor', 'location'];
    // valid series
    this.validSensors = {
        SENSOR_GPS: {
            key: 'location'
          , series: {
                latitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Latitude (˚)' }
                  , labels: [ 'time', '˚' ]
                }
              , longitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Longitude (˚)' }
                  , labels: ['time', '˚' ]
                }
              , altitude: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Altitude (m)' }
                  , labels: ['time', 'm' ]
                }
              , speed: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Speed (m/s)' }
                  , labels: ['time', 'm/s' ]
                }
            }
        }
      , SENSOR_CELLPOS: {
          key: 'location'
        , series: {
              latitude: {
                  dataPoints: []
                , cycleStartTimes: []
                , titles: { x: 'Time', y: 'Latitude (˚)' }
                , labels: [ 'time', '˚' ]
              }
            , longitude: {
                  dataPoints: []
                , cycleStartTimes: []
                , titles: { x: 'Time', y: 'Longitude (˚)' }
                , labels: ['time', '˚' ]
              }
          }
      }
      , SENSOR_ACCEL: {
            key: 'sensor'
          , name: 'acceleration'
          , series: {
                acceleration: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Acceleration (m/s^2)' }
                  , labels: ['time', '(ax)', '(ay)', '(az)']
                }
            }
        }
      , SENSOR_COMPASS: {
            key: 'sensor'
          , name: 'compass'
          , series: {
                compass: {
                    dataPoints: []
                  , cycleStartTimes: []
                  , titles: { x: 'Time', y: 'Heading (˚)' }
                  , labels: ['time', '(x)', '(y)', '(z)']
                }
            }
        }
    };
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
              , time = new Date(parseInt(event.header.startTime))
              , src = event.header.source
            ;
            if (lenk) {
              // is array
              var name = data[source].name
                , series = data[source].series[name]
                , point = []
              ;
              point.push(time);
              for (var k = 0; k < lenk; k++)
                point.push(key[k]);
              // add to series
              series.dataPoints.push(point);
              // check if first
              if (series.cycleStartTimes.length === i)
                series.cycleStartTimes.push(time);
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
                }
              }
            }
          }
        }
      }
    }

    // done
    this.visibleSensors = data;

    // log for now
    console.log(data);
  };

  Sandbox.prototype.add = function (type, wrap, fn) {
    switch (type) {
      case 'Map':
        this.map = new Map(this, wrap);
        this.widgets.push(this.map);
        this.map.init(fn);
        break;
      case 'TimeSeries':
        this.timeseries = new TimeSeries(this, wrap);
        this.widgets.push(this.timeseries);
        this.timeseries.init(fn);
        break;
    }
  };

  Sandbox.prototype.notify = function (type, params, fn) {
    switch (type) {
      case 'cs-time-window-change':
        this.reEvaluateData(params, fn);
        break;
      case 'cs-point-hover':
        this.map.update(params.time);
        break;
    }
  };

  Sandbox.prototype.reEvaluateData = function (params, fn) {
    var self = this
      , min = params.range[0]
      , max = params.range[1]
      , visible = []
      , redraw = false
    ;
    // check window bounds
    for (var i = 0, len = self.raw.length; i < len; i++) {
      var index;
      if ((self.raw[i].bounds.start >= min && self.raw[i].bounds.start <= max) ||
        (self.raw[i].bounds.stop >= min && self.raw[i].bounds.stop <= max)
      ) {
        visible.push(self.raw[i]._id);
      } else if ((self.raw[i].bounds.start > max || self.raw[i].bounds.stop < min) &&
        (index = self.visibleCycles.indexOf(self.raw[i]._id)) !== -1 &&
        self.visibleCycles.length > 1
      ) {
        delete self.raw[i].events;
        self.visibleCycles.splice(index, 1);
        redraw = true;
      }
    }
    // remove cycle ids who's data we already have
    var empty = [];
    for (var i = 0, leni = visible.length; i < leni; i++) {
      var exists = false;
      for (var j = 0, lenj = self.visibleCycles.length; j < lenj; j++) {
        if (visible[i] == self.visibleCycles[j]) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        empty.push(visible[i]);
        self.visibleCycles.push(visible[i]);
      }
    }
    // get new data
    if (empty.length > 0) {
      // show loading for this chart
      params.plot.showLoading(params.index);
      // call server
      $.get('/cycles', { cycles: empty }, function (serv) {
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
    var defaultSeries = ['acceleration', 'compass']
      , charts = []
      , plotColors = [orange, blue, green, red, yellow, purple]
      , blockRedraw = false
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
                  
                  // add to charts
                  charts.push(new Dygraph(wrap[0], points, {
                      width: wrap.width()
                    , height: (wrap.height() - (5 * (len - 1))) / len
                    , index: i
                    , of: len
                    , key: desiredSeries[i]
                    , sensor: s
                    , rightGap: 0
                    , fillGraph: true
                    , fillAlpha: 0.05
                    , gridLineColor: 'rgba(255,255,255,0.25)'
                    , colors: colors
                    , strokeWidth: 0.5
                    , labels: plot.labels
                    , axisLineColor: 'rgba(0,0,0,0)'
                    , axisLabelColor: '#808080'
                    , axisLabelFontSize: 9
                    , xlabel: plot.titles.x
                    , ylabel: plot.titles.y
                    , stepPlot: true
                    , starts: plot.cycleStartTimes
                    , interactionModel : {
                          mousedown: downV3
                        , mousemove: moveV3
                        , mouseup: upV3
                        , click: clickV3
                        , dblclick: dblClickV4
                        , mousewheel: scrollV3
                      }
                    , highlightCallback: function(e, x, pts, row) {
                        // notify sandbox
                        box.notify('cs-point-hover', {
                          time: new Date(x)
                        });
                      }
                    , drawCallback: function (me, initial) {
                        var range = me.xAxisRange()
                          , yrange = me.yAxisRange()
                        ;
                        // notify sandbox
                        box.notify('cs-time-window-change', {
                            range: range
                          , plot: self
                          , index: me.index
                        }, function (redraw) {
                          // synch with other plots
                          if (charts.length < len || blockRedraw)
                            return;
                          blockRedraw = true;
                          for (var k = 0, lenk = charts.length; k < lenk; k++) {
                            if (charts[k] == me || !charts[k].file_)
                              continue;
                            charts[k].updateOptions({
                              dateWindow: range
                            });
                          }
                          blockRedraw = false;
                          
                          // update plots with new data
                          if (redraw) {
                            for (var j = 0, lenj = charts.length; j < lenj; j++) {
                              var sen = box.visibleSensors[charts[j].sensor]
                                , ser = sen.series[charts[j].key]
                              ;
                              charts[j].updateOptions({
                                  file: ser.dataPoints
                                , starts: ser.cycleStartTimes
                              });
                            }
                            self.hideLoading();
                          }
                        });
                      }
                  }));
                }
              }
            }
          }
          
          // add ref to all charts in each
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].updateOptions({
              siblings: charts
            });
          }
          
          // callback
          fn();
        }
      , resize: function (wl, hl, wr, hr) {
          if (!wr)
            wr = wrap.width();
          if (!hr)
            hr = wrap.height();
          for (var i = 0, len = charts.length; i < len; i++) {
            charts[i].resize(wr, (hr - (5 * (len - 1))) / len);
          }
        }
      , showLoading: function (index) {
          $('.series-loading', wrap).show();
          for (var i in charts) {
            if (charts.hasOwnProperty(i)) {
              $(charts[i].graphDiv).css({ opacity: 0.2 });
            }
          }
        }
      , hideLoading: function () {
          $('.series-loading', wrap).hide();
          for (var i = 0, len = charts.length; i < len; i++)
            $(charts[i].graphDiv).css({ opacity: 1 });
        }
      , getChart: function (index) {
          return charts[index];
        }
      , clear: function () {

        }
    };
  };


  var Map = function (box, wrap) {
    var points = []
      , map
      , map_width = wrap.width()
      , map_height = wrap.height()
      , mapOptions = {
            disableDefaultUI: true
          , mapTypeControlOptions: {
              mapTypeIds: [ google.maps.MapTypeId.ROADMAP, 'greyscale' ]
            }
        }
      , mapType = new google.maps.StyledMapType(mapStylez, mapStyledOptions)
      , poly = new google.maps.Polyline({
            strokeColor: '#ff0000'
          , strokeOpacity: 0.5
          , strokeWeight: 5
          , clickable: false
        })
      , distance
      , dots = []
      , cellDots = []
      , dotStyle = {
            strokeWeight: 0
          , fillColor: "#00ff00"
          , fillOpacity: 0.5
          , radius: 10
          , clickable: false
        }
      , cellDotStyle = {
            strokeWeight: 0
          , fillColor: "#0000ff"
          , fillOpacity: 0.5
          , radius: 50
          , clickable: false
        }
      , start
      , end
      , cursor = new google.maps.Circle({
            strokeWeight: 0
          , fillColor: "#0000ff"
          , fillOpacity: 0.5
          , radius: 50
          , clickable: false
        })

      , firstRun = true
      , loadedHandle

      , plot = function (data, fn) {
          // poly bounds
          var minlat = 90
            , maxlat = -90
            , minlawn = 180
            , maxlawn = -180
          ;

          // build poly
          for (var i = 0, len = data.SENSOR_GPS.series.latitude.dataPoints.length;  i < len; i++) {
            var lat = data.SENSOR_GPS.series.latitude.dataPoints[i][1]
              , lawn = data.SENSOR_GPS.series.longitude.dataPoints[i][1]
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
            // if (data.SENSOR_GPS.series.latitude.sources[i] == 'SENSOR_CELLPOS') {
            //   var d = new google.maps.Circle(cellDotStyle);
            //   d.setCenter(ll);
            //   cellDots.push(d);
            // } else
              poly.getPath().push(ll);
          }

          // get path length
          //distance = google.maps.geometry.spherical.computeLength(poly.getPath());

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
          });

          // endpoints
          start = new google.maps.Marker({
              map: map
            , animation: google.maps.Animation.DROP
            , position: poly.getPath().getAt(0)
          });
          end = new google.maps.Marker({
              map: map
            , animation: google.maps.Animation.DROP
            , position: poly.getPath().getAt(poly.getPath().getLength() - 1)
          });

          // center and zoom
          map.setCenter(mapBounds.getCenter());
          map.fitBounds(mapBounds);

          // track cursor position
          wrap.bind('mousemove', function (e) {
            var m = mouse(e, wrap)
              , w = wrap.width()
              , l = poly.getPath().getLength()
              , f = Math.floor((m.x / w) * l)
              , c = poly.getPath().getAt(f)
            ;
            cursor.setPosition(c);
          });

          // ready
          loadedHandle = google.maps.event.addListener(map, 'tilesloaded', function () {
            if (firstRun) {
              firstRun = false;
              google.maps.event.trigger(map, 'resize');
              map.setCenter(mapBounds.getCenter());
              map.fitBounds(mapBounds);
              fn();
              wrap.removeClass('map-tmp');
            }
          });
        }

      , toMiles = function (m) {
          return m / 1609.344;
        }
    ;

    return {
        init: function (fn) {
          // hide wrap
          wrap.hide();

          // exit if nothing to do
          if (box.visibleSensors.SENSOR_GPS.series.latitude.dataPoints.length === 0) {
            fn(true);
            return;
          }

          // plot map
          plot(box.visibleSensors, fn);

          // fade in
          wrap.fadeIn(2000);
        }
      , extract: function () {
          points = [];
          var locations = box.visibleSensors.SENSOR_GPS.series
            , len = locations.latitude.dataPoints.length
          ;
          for (var i = 0; i < len; i++) {
            var time = locations.locations.latitude.dataPoints[i][0]
              , lat = locations.locations.latitude.dataPoints[i][1]
              , lawn = locations.locations.longitude.dataPoints[i][1]
            ;
            points.push([time, lat, lawn]);
          }
        }
      , update: function (time) {
          //console.log(time);
        }
      , resize: function (wl, hl, wr, hr) {
          if (!map)
            return;
          google.maps.event.trigger(map, 'resize');
          if (!wl)
            wl = map_width;
          if (!hl)
            hl = map_height;
          map.panBy((map_width - wl) / 2, (map_height - hl) / 2);

          map_width = wrap.width();
          map_height = wrap.height();
        }
      , clear: function () {
          if (!map)
            return;
          // remove event listeners
          wrap.unbind('mousemove');
          google.maps.event.removeListener(loadedHandle);
          // remove polygons
          poly.setMap(null);
          for (var k = 0, len = dots.length; k < len; k++)
            dots[k].setMap(null);
          for (var k = 0, len = cellDots.length; k < len; k++)
            cellDots[k].setMap(null);
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


        if (window.location.pathname == '/login') {
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

          sizeDetailPanes();
        }

        // get relative comment times
        setInterval(updateTimes, 5000); updateTimes();


        //////// HANDLERS


        if (window.location.pathname == '/login') {

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

          $('img.resize-x, img.resize-y').live('mousedown', function (e) {
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
                      this.add('Map', $('.map', deetsKid), function (empty) {
                        if (empty)
                          $('.map-loading span', deetsKid).text('No map data.');
                        else
                          $('.map-loading', deetsKid).hide();
                      });
                      this.add('TimeSeries', $('.details-right', deetsKid), function (empty) {
                        if (empty) {
                          $('.series-loading span', deetsKid).text('No time series data.');
                        } else {
                          $('.series-loading', deetsKid).hide();
                        }
                      });
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
          //$($('a.expander')[0]).click();
        }
      }
  }
})(jQuery);

