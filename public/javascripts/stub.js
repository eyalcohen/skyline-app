

Stub = (function ($) {
  
  var expandDetailsTo = 436
    
    , orange = '#ff931a'
    , blue = '#55f5f2'
    , green = '#00f62e'
    
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
  ;
  
  var Sandbox = function (data, fn) {
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
    var widg = new (eval(type))(wrap);
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
      
      , plot = function (fn) {
          points = [];
          for (var j=0; j < data.length; j++) {
            points.push([ new Date(data[j].t), data[j].a.x, data[j].a.y, data[j].a.z ]);
          }
          var lines = []
            , xline
          ;
          chart = new Dygraph(wrap[0], points, {
              width: wrap.width()
            , height: wrap.height()
            , rightGap: 0
            , fillGraph: true
            , fillAlpha: 0.05
            , gridLineColor: 'rgba(255,255,255,0.25)'
            , colors: [orange, blue, green]
            , strokeWidth: 0.5
            , labels: [ 'time', '(ax)', '(ay)', '(az)' ]
            , axisLineColor: 'rgba(0,0,0,0)'
            , axisLabelColor: '#808080'
            , axisLabelFontSize: 9
            , xlabel: 'Time'
            , ylabel: 'Acceleration (m/s^2)'
            , stepPlot: true
            , panEdgeFraction: 0.0001
            , interactionModel : {
                  mousedown: downV3
                , mousemove: moveV3
                , mouseup: upV3
                , click: clickV3
                , dblclick: function (event, g, context) {
                    dblClickV4(event, g, context);
                    chart.updateOptions({ 
                      dateWindow: [ points[0][0].valueOf() + 1, points[points.length-1][0].valueOf()]
                    });
                  }
                , mousewheel: scrollV3
              }
          });
          chart.updateOptions({ 
            dateWindow: [ points[0][0].valueOf() + 1, points[points.length-1][0].valueOf()] 
          });
          // callback
          fn();
        }
      , toMPH = function (ms) {
          return ms * 2.23693629;
        }
      
    ;
    
    return {
        init: function (dat, fn) {
          // save data
          data = dat;
          
          // plot it
          if (data.length == 0)
            fn(true);
          else {
            plot(fn);
          }
        }
      , resize: function (wl, hl, wr, hr) {
          if (!wr)
            wr = wrap.width();
          if (!hr)
            hr = wrap.height();
          chart.resize(wr, hr);
        }
      , clear: function () {
          
        }
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
      
      , plot = function (fn) {
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
              minlat = lat;
            if (lat > maxlat)
              maxlat = lat;
            if (lawn < minlawn)
              minlawn = lawn;
            if (lawn > maxlawn)
              maxlawn = lawn;
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
            google.maps.event.trigger(map, 'resize');
            fn();
            wrap.removeClass('map-tmp');
          });
        }
      
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
          
          // exit if nothing to do
          if (data.length == 0) {
            fn(true);
            return;
          }
          
          // plot map
          plot(fn);
          
          // fade in
          wrap.fadeIn(2000);
        }
      , resize: function (wl, hl, wr, hr) {
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
          //wrap.remove();
        }
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
          
          // register user
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
            e.preventDefault();
            makeUser(this);
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
                , action: '/usercreate/jit@ridemission.com'
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
                , 'value': 'Sander Pick'
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
                , action: '/vehiclecreate/sander@ridemission.com/Ducati/1098/2011'
              })
              .hide()
              .append('<input type="hidden" />')
              .find('input')
              .attr({
                  'name': 'password'
                , 'value': 'admin'
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
                , action: '/summary/sander@ridemission.com/718793916'
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
                    if (!deetsKid.data().sandbox) {
                      var sandbox = new Sandbox(serv.data.bucks, function () {
                        this.add('TimeSeries', $('.details-right', deetsKid), function (empty) {
                          if (empty)
                            $('.series-loading', deetsKid).text('No time series data.');
                          else
                            $('.series-loading', deetsKid).hide();
                        });
                        this.add('Map', $('.map', deetsKid), function (empty) {
                          if (empty)
                            $('.map-loading', deetsKid).text('No map data.');
                          else
                            $('.map-loading', deetsKid).hide();
                        });
                        // add sanbox to details div
                        deetsKid.data({ sandbox: this });
                      });
                    }
                  } else
                    console.log(serv.message);
                });
              });
              handle.animate({ top: (expandDetailsTo / 2) - handle.height() }, 150, 'easeOutExpo');
            } else {
              arrow.removeClass('open');
              deetsHolder.hide();
              deets.css({ height: 20 });
              deetsKid.data().sandbox.widgets.forEach(function (w) {
                w.clear(); 
              });
            }
          });
          
          
          // TMP -- open the first vehicle pane
          $($('a.expander')[1]).click();
        }
        
      }


  }

})(jQuery);

