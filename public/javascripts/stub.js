

Stub = (function ($) {
  
  var expandDetailsTo = 436
    
    , orange = '#ff931a'
    , blue = '#55f5f2'
    , green = '#00f62e'
    
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
    
    , sizeDetailPanes = function () {
        var ww = $(window).width()
          , lw = (ww - 10) * 0.6
          , rw = (ww - 10) * 0.4
        ;
        $('.details-left').width(lw);
        $('.details-right').width(rw);
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
  ;
  
  var Sandbox = function (data, fn) {
    console.log(data);
    
    //-- TEMP!
    data = data[data.length - 1];
    var widgets = []
      , locations = []
      , accels = []
      // computed
      , speeds = []
    ;
    
    // parse events
    for (var i=0; i < data.events.length; i++) {
      if (data.events[i].location)
        locations.push({ g: data.events[i].location, s: data.events[i].header.source, t: parseInt(data.events[i].header.startTime) });
      if (data.events[i].accelerometer)
        accels.push({ a: data.events[i].accelerometer, t: parseInt(data.events[i].header.startTime) });
    }
    // for (var j=1; j < locations.length; j++) {
    //   var d = google.maps.geometry.spherical.computeDistanceBetween(
    //     new google.maps.LatLng(locations[j].g.latitude, locations[j].g.longitude),
    //     new google.maps.LatLng(locations[j-1].g.latitude, locations[j-1].g.longitude)
    //   );
    //   speeds.push({ s: (d / (locations[j].t - locations[j-1].t)) * 1000, t: (locations[j].t + locations[j-1].t) / 2 });
    // }
    
    this.widgets = widgets;
    this.locations = locations;
    this.accels = accels;
    this.speeds = speeds;
    
    fn.call(this);
  };
  
  Sandbox.prototype.add = function (type, wrap, fn) {
    var widg = new (eval(type))(wrap)
      , data
    ;
    switch (type) {
      case 'TimeSeries':
        widg.init(this.accels, fn);
        break;
      case 'Map':
        widg.init(this.locations, fn);
        break;
    }
    this.widgets.push(widg);
  };
  
  
  var TimeSeries = function (wrap) {
    var data
      , points
      , chart
      , canvas = $('<canvas width="' + wrap.width() + '" height="' + wrap.height() + '"></canvas>')
      , ctx
      
      , plot = function () {
          points = [];
          for (var j=0; j < data.length; j++) {
            points.push([ new Date(data[j].t), data[j].a.x, data[j].a.y, data[j].a.z ]);
            //points.push([ new Date(data[j].t), toMPH(data[j].s) ]);
          }
          var lines = []
            , xline
          ;
          chart = new Dygraph(wrap[0], points, {
              width: wrap.width()
            , height: wrap.height()
            , rightGap: 0
            //, fillGraph: true
            , fillAlpha: 0.05
            , gridLineColor: '#363636'
            , colors: [orange, blue, green]
            , strokeWidth: 1
            , labels: [ 'time', 'ax m/s^2', 'ay m/s^2', 'az m/s^2' ]
            , axisLineColor: 'rgba(0,0,0,0)'
            , axisLabelColor: '#666'
            , axisLabelFontSize: 9
            , stepPlot: true
            , panEdgeFraction: 0.1
            , interactionModel : {
                  mousedown: downV3
                , mousemove: moveV3
                , mouseup: upV3
                , click: clickV3
                , dblclick: dblClickV4
                , mousewheel: scrollV3
              }
            // , highlightCallback: function (e, x, pts) {
            //     for (var i = 0; i < pts.length; i++) {
            //       var y = pts[i].canvasy;
            //       lines[i].show().css({ top: y + 'px' });
            //       if (i == 0)
            //         xline.css({ left: pts[i].canvasx + 'px' });
            //     }
            //     xline.show();
            //   }
            // , unhighlightCallback: function(e) {
            //     for (var i = 0; i < 2; i++) {
            //       lines[i].hide();
            //     }
            //     xline.hide();
            //   }
          });
          // for (var i = 0; i < 2; i++) {
          //   var line = $('<div />').hide().css({ 
          //       width: '100%'
          //     , height: 1
          //     , backgroundColor: '#797979'
          //     , position: 'absolute' 
          //   }).appendTo(wrap);
          //   lines.push(line);
          // }
          // 
          // var xline = $('<div />').hide().css({ 
          //     width: 1
          //   , height: '100%'
          //   , backgroundColor: '#797979'
          //   , position: 'absolute' 
          // }).appendTo(wrap);
          
        }
      // , drawBacker = function () {
      //   var j = 5
      //     , n = canvas.width() / j
      //     , x = j
      //     , h = canvas.height()
      //   ;
      //   
      //   ctx.clearRect(0, 0, canvas.width(), canvas.height());
      //   ctx.globalAlpha = 1;
      //   ctx.strokeStyle = "#1f1f1f";
      //   ctx.lineWidth = 0.5;
      //   ctx.beginPath();
      //   
      //   for (var i=0; i < n - 1; i++) {
      //     ctx.moveTo(x, 0);
      //     ctx.lineTo(x, h);
      //     x += j
      //   }
      //   ctx.stroke();
      // }
      , toMPH = function (ms) {
          return ms * 2.23693629;
        }
      
    ;
    
    return {
        init: function (dat, fn) {
          // save data
          data = dat;
          
          // plot it
          plot();
          
          // callback
          fn();
        }
      , resize: function (wl, hl, wr, hr) {
          if (!wl)
            wl = wrap.width();
          if (!hl)
            hl = wrap.height();
          chart.resize(wl, hl);
        }
      , clear: function () {}
    };
  };
  
  
  var Map = function (wrap) {
    var data
      , map
      , map_width = wrap.width()
      , map_height = wrap.height()
      , mapOptions = {
            zoom: 13
          , disableDefaultUI: true
          , mapTypeControlOptions: {
              mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'greyscale']
            }
        }
      , stylez = [
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
      , styledOptions = {
          name: 'GrayScale'
        }
      , mapType = new google.maps.StyledMapType(stylez, styledOptions)
      , poly = new google.maps.Polyline({
            strokeColor: '#ff0000'
          , strokeOpacity: 0.5
          , strokeWeight: 5
          , clickable: false
        })
      , poly_cell = new google.maps.Polyline({
            strokeColor: '#00ffff'
          , strokeOpacity: 0.5
          , strokeWeight: 5
          , clickable: false
        })
      , distance
      , dots = []
      , dotStyle = {
            strokeWeight: 0
          , fillColor: "#00ff00"
          , fillOpacity: 0.5
          , radius: 10
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
      
      
      , toMiles = function (m) {
          return m / 1609.344;
        }
    
    ;
    
    return {
        init: function (dat, fn) {
          // hide wrap
          wrap.hide();
          
          // ref data
          data = dat;
          
          // poly bounds
          var minlat = 90
            , maxlat = -90
            , minlawn = 180
            , maxlawn = -180
          ;
          
          // build poly
          for (var i=0; i < data.length; i++) {
            var lat = data[i].g.latitude
              , lawn = data[i].g.longitude
            ;
            if (lat < minlat)
              minlat = lat
            if (lat > maxlat)
              maxlat = lat
            if (lawn < minlawn)
              minlawn = lawn
            if (lawn > maxlawn)
              maxlawn = lawn
            var ll = new google.maps.LatLng(lat, lawn);
            if (data[i].s == 'SENSOR_CELLPOS')
              poly_cell.getPath().push(ll);
            else
              poly.getPath().push(ll);
            var d = new google.maps.Circle(dotStyle);
            d.setCenter(ll);
            dots.push(d);
          }
          
          // get path length
          distance = google.maps.geometry.spherical.computeLength(poly.getPath());
          
          // set map 'center' from poly bounds
          mapOptions.center = new google.maps.LatLng((minlat + maxlat) / 2, (minlawn + maxlawn) / 2);
          
          // make new map
          map = new google.maps.Map(wrap[0], mapOptions);
          map.mapTypes.set('grayscale', mapType);
          map.setMapTypeId('grayscale');
          
          // set objects
          poly.setMap(map);
          poly_cell.setMap(map);
          for (var k=0; k < dots.length; k++)
            dots[k].setMap(map);
          
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
          google.maps.event.addListener(map, 'tilesloaded', function () {
            fn();
            wrap.removeClass('map-tmp');
          });
          
          // fade in
          wrap.fadeIn(2000);
        }
      , resize: function (wl, hl, wr, hr) {
          google.maps.event.trigger(map, 'resize');
          if (!wr)
            wr = map_width;
          if (!hr)
            hr = map_height;
          map.panBy(map_width - wr, map_height - hr);
          
          map_width = wrap.width();
          map_height = wrap.height();
        }
      , clear: function () {}
    };
  };
  
  
  return {
    
    /**
     * setup doc
     */
      
      go: function () {
        
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
        
        
        //////// HANDLERS
        
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
          });
        });
        
        
        // resize vertical panes
        $('.details-bar-bottom, img.resize-y').bind('mousedown', function (e) {
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
        $('.details-bar-middle, img.resize-x').bind('mousedown', function (e) {
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
        
        $('img.resize-x, img.resize-y').bind('mousedown', function (e) {
          if (e.preventDefault) e.preventDefault();
        });
        
        
        // initial vehicle cycle query 
        $('a.expander').live('click', function () {
          var $this = $(this)
            , arrow = $('img', $this)
            , deetsHolder = $(this.parentNode.parentNode.nextElementSibling)
            , deets = $(deetsHolder.children().children())
            , deetsKid = $(deetsHolder.children().children().children())
            , handle = $('img.resize-x', deets)
          ;
          if (!arrow.hasClass('open')) {
            arrow.addClass('open');
            deetsHolder.show();
            deets.animate({ height: expandDetailsTo }, 150, 'easeOutExpo', function () {
              $.get('/v/' + $this.itemID(), { id: $this.itemID() }, function (serv) {
                if (serv.status == 'success') {
                  var sandbox = new Sandbox(serv.data.bucks, function () {
                    this.add('TimeSeries', $('.details-left', deets), function () {
                      $('.series-loading', deets).hide();
                    });
                    this.add('Map', $('.map', deets), function () {
                      $('.map-loading', deets).hide();
                    });
                    // add sanbox to details div
                    deetsKid.data({ sandbox: this });
                  });
                } else
                  console.log(serv.message);
              });
            });
            handle.animate({ top: (expandDetailsTo / 2) - handle.height() }, 150, 'easeOutExpo');
          } else {
            arrow.removeClass('open');
            deetsHolder.hide();
            deets.css({ height: 20 });
          }
        });
        
        
        // TMP -- open the first vehicle pane
        $('a.expander:first').click();
        
      }


  }

})(jQuery);

