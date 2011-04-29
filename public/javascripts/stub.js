

Stub = (function ($) {
  
  
  
  var expandDetailsTo = 436
  
  
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
    
    , Map = function (wrap) {
        var data
          , mapData
          , map
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
              , strokeOpacity: 0.8
              , strokeWeight: 2
              , clickable: false
            })
          , distance
          , cursor = new google.maps.Circle({
                strokeColor: '#0000ff'
              , strokeOpacity: 0.8
              , strokeWeight: 0
              , fillColor: "#0000ff"
              , fillOpacity: 1
              , radius: 50
              , clickable: false
            })
          
          
          , toMiles = function (m) {
              return m / 1609.344;
            }
        
        ;
        
        return {
            init: function (bucks, fn) {
              // hide wrap
              wrap.hide();
              
              // ref data
              data = bucks;
              
              // use latest bucket
              mapData = data[data.length - 1];
              
              // ploy bounds
              var minlat = 90
                , maxlat = -90
                , minlawn = 180
                , maxlawn = -180
              ;
              
              // parse events
              for (var i=0; i < mapData.events.length; i++) {
                if (mapData.events[i].location) {
                  var lat = mapData.events[i].location.latitude
                    , lawn = mapData.events[i].location.longitude
                  ;
                  if (lat < minlat)
                    minlat = lat
                  if (lat > maxlat)
                    maxlat = lat
                  if (lawn < minlawn)
                    minlawn = lawn
                  if (lawn > maxlawn)
                    maxlawn = lawn
                  poly.getPath().push(new google.maps.LatLng(lat, lawn));
                }
              }
              
              // get path length
              distance = google.maps.geometry.spherical.computeLength(poly.getPath());
              
              // set cursor
              cursor.setCenter(poly.getPath().getAt(0));
              
              // set map 'center' from poly bounds
              mapOptions.center = new google.maps.LatLng((minlat + maxlat) / 2, (minlawn + maxlawn) / 2);
              
              // make new map
              map = new google.maps.Map(wrap[0], mapOptions);
              map.mapTypes.set('grayscale', mapType);
              map.setMapTypeId('grayscale');
              
              // track cursor position
              wrap.bind('mousemove', function (e) {
                var m = mouse(e, wrap)
                  , w = wrap.width()
                  , l = poly.getPath().getLength()
                  , f = Math.floor((m.x / w) * l)
                  , c = poly.getPath().getAt(f)
                ;
                cursor.setCenter(c);
              });
              
              // resize cursor on zoom
              google.maps.event.addListener(map, 'zoom_changed', function () {
                var r = -10 * map.getZoom() + 180;
                if (r < 10)
                 r = 5;
                cursor.setRadius(r);
              });
              
              // draw path and cursor
              poly.setMap(map);
              cursor.setMap(map);
              
              // fade in
              wrap.fadeIn(2000, function () { wrap.removeClass('map-tmp') });
              
              // callback
              fn();
            }
          , clear: function () {}
        };
      }
      
    , TimeSeries = function (wrap) {
        var data
          , canvas = $('<canvas width="100%" height="100%"></canvas>')
          , ctx
        ;
        
        return {
            init: function (d) {
              console.log(d);
              // save data
              data = d;
              // remove loading text wrap
              //$('.details-loader-wrap', wrap).remove();
              // add canvas
              //canvas.prependTo(wrap);
              // text select tool fix for chrome on mousemove
              canvas[0].onselectstart = function () { return false; };
              // get context
              ctx = canvas[0].getContext('2d');
              
            }
          , clear: function () {}
        };
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
            , handle = $('img.resize-x', deets)
          ;
          if (!arrow.hasClass('open')) {
            arrow.addClass('open');
            deetsHolder.show();
            deets.animate({ height: expandDetailsTo }, 150, 'easeOutExpo', function () {
              $.get('/v/' + $this.itemID(), { id: $this.itemID() }, function (serv) {
                if (serv.status == 'success') {
                  var ts = new TimeSeries($('.details-left', deets));
                  ts.init(serv.data.bucks, function () {
                    // hide loading text
                    $('.series-loading', deets).remove();
                  });
                  var map = new Map($('.map', deets));
                  map.init(serv.data.bucks, function () {
                    // hide loading text
                    $('.map-loading', deets).remove();
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
        
        
        
        
      }


  }

})(jQuery);

