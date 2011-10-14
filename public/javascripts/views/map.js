/*!
 * Copyright 2011 Mission Motors
 */

var mapsLoadNotifier = _.clone(Backbone.Events);
requirejs(['async!http://maps.google.com/maps/api/js?' +
              'libraries=geometry&sensor=false!callback'],
          function() {
  var notifier = mapsLoadNotifier;
  mapsLoadNotifier = null;
  notifier.trigger('load');
});

define([ 'views/dashItem', 'map_style' ], function (DashItemView, style) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts) {
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
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('map.dash.jade', opts).appendTo(parent);
      this._super('render');
      return this;
    },

    createMap: function() {
      this.render(); // Why is this necessary?
      // Create empty map.
      var options = {
        disableDefaultUI: false,
        mapTypeControlOptions: {
          mapTypeIds: [google.maps.MapTypeId.ROADMAP,
              google.maps.MapTypeId.SATELLITE,
              google.maps.MapTypeId.HYBRID,
              google.maps.MapTypeId.TERRAIN],
        },
      };
      var map = this.map =
          new google.maps.Map($('.map', this.content).get(0), options);
      // map.mapTypes.set('grayscale',
      //     new google.maps.StyledMapType(style.stylez, style.styledOptions));
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);

      // cursor
      this.cursor = new google.maps.Marker({
        map: null,  // Hidden for now.
        icon: 'http://google-maps-icons.googlecode.com/files/car.png',
        zIndex: 1000001,
        clickable: false,
      });

      // enter map
      google.maps.event.addListener(map, 'mouseover', function (e) {
        // show time
        //$('.map-time', wrap.parent()).show();
      });

      // clear plot when leave map
      google.maps.event.addListener(map, 'mouseout', function (e) {

        // notify sandbox
        //box.notify('cs-map-cursorout');

        // hide time
        //$('.map-time', wrap.parent()).hide();
      });

      // move cursor on mouse hover
      // google.maps.event.addListener(map, 'mousemove', function (e) {
      //
      //   // inits
      //   var minDist = 1e+100,
      //       snapTo,
      //       keys = Object.keys(e.latLng);
      //
      //   // find closest point
      //   times.forEach(function (t) {
      //
      //     // compute distances
      //     var deltaLat = Math.abs(gpsPoints[t][keys[0]] - e.latLng[keys[0]]),
      //         deltaLawn = Math.abs(gpsPoints[t][keys[1]] - e.latLng[keys[1]]),
      //         dist = Math.sqrt((deltaLat * deltaLat) + (deltaLawn * deltaLawn));
      //
      //     // compare distance
      //     if (dist < minDist) {
      //       minDist = dist;
      //       snapTo = { time: parseInt(t), latLng: gpsPoints[t] };
      //     }
      //
      //   });
      //
      //   // move the cursor
      //   if (snapTo) {
      //     cursor.setPosition(snapTo.latLng);
      //
      //     // notify sandbox
      //     box.notify('cs-map-cursormove', snapTo.time);
      //   }
      //
      //   // update time
      //   var timeTxt = (new Date(snapTo.time / 1000)).toLocaleString();
      //   var gmti = timeTxt.indexOf(' GMT');
      //   if (gmti !== -1)
      //     timeTxt = timeTxt.substr(0, gmti);
      //   // $('.map-time', wrap.parent()).text(timeTxt);
      // });

      // ready
      google.maps.event.addListener(
            map, 'tilesloaded', function () {
        // if (firstRun) {
          // firstRun = false;
          //google.maps.event.trigger(map, 'resize');
          //if (this.mapBounds) {
          //  map.setCenter(mapBounds.getCenter());
          //  map.fitBounds(mapBounds);
          //}
          //wrap.removeClass('map-tmp');
          //showInfo();
        // }
      });
    },

    draw: function(options) {
      if (mapsLoadNotifier) {
        // Maps is not yet loaded - delay drawing until it's available.
        console.log('Deferring map draw.');
        mapsLoadNotifier.bind('load', _.bind(this.draw, this, options));
        return;
      }

      if (!this.map)
        this.createMap();
      options = options || {};
      var map = this.map;

      function subtractPoints(points, removePoints) {
        // Subtract visible time ranges from navigable data.
        var rI = 0, remBeg, remEnd;
        function nextR() {
          if (rI >= removePoints.length)
            return remBeg = remEnd = null;
          remEnd = remBeg = removePoints[rI]
          var next;
          while ((next = removePoints[++rI]) && next.beg == remEnd.end) {
            remEnd = next;
          }
        }
        nextR();
        var result = [];
        points.forEach(function(p) {
          if (remEnd && p.beg >= remEnd.end)
            nextR();
          if (!remBeg || remBeg.beg >= p.end) {
            // Sample does not overlap sample to remove.
            result.push(p);
          } else if (remEnd.end < p.end) {
            // Sample to remove overlaps beginning of this sample.
            var n = _.clone(remEnd);
            n.beg = n.end = p.end;
            result.push(n);
          } else /* if (r.beg < p.end) */ {
            // Sample to remove overlaps end of this sample.
            var n = _.clone(remBeg);
            n.beg = n.end = p.beg;
            result.push(n);
          }
        });
        return result;
      }

      function pointsToGeometry(points, polyOptions, dotOptions) {
        var bounds = new google.maps.LatLngBounds();
        var geometry = { polys: [], dots: [], bounds: bounds };
        var pendingPoly = [];
        function newPoly() {
          if (pendingPoly.length > 1)
            geometry.polys.push(new google.maps.Polyline(
                _.extend({ path: pendingPoly }, polyOptions)));
          pendingPoly = [];
        };
        points.forEach(function(p, i) {
          if (i > 0 && p.beg != points[i-1].end)
            newPoly();
          var ll = new google.maps.LatLng(p.lat, p.lng);
          pendingPoly.push(ll);
          // TODO: no dot when min/max exists?
          /* The dots are very slow, omit them for now:
          if (dotOptions)
            geometry.dots.push(new google.maps.Circle(
                _.extend({ center: ll }, dotOptions)));
          */
          bounds.extend(ll);
        });
        newPoly();
        return geometry;
      }

      function reMap(geometry, map) {
        if (!geometry) return;
        function f(p) { p.setMap(map); }
        geometry.polys.forEach(f);
        geometry.dots.forEach(f);
      }

      if (!options.noPointsChange) {
        // Fetch points, and subtract visible points from navigable.
        var pointsVisible = this.model.get('pointsVisible') || [];
        var pointsNavigable = subtractPoints(
            this.model.get('pointsNavigable') || [], pointsVisible);

        // Create the visible points geometry.
        var oldGeometry = this.visibleGeometry;
        this.visibleGeometry = pointsToGeometry(pointsVisible,
            {  // polyOptions
              strokeColor: '#0000ff',
              strokeOpacity: 0.6,
              strokeWeight: 8,
              clickable: false,
              zIndex: 10,
            }, {  // dotOptions
              strokeWeight: 0,
              fillColor: "#ffffff",
              fillOpacity: 0.5,
              radius: 10,
              clickable: false,
              zIndex: 10,
            });
        // UnMap after rendering to avoid flickering.
        reMap(this.visibleGeometry, map);
        reMap(oldGeometry, null);

        // Create the navigable points geometry.
        var oldGeometry = this.navigableGeometry;
        this.navigableGeometry = pointsToGeometry(pointsNavigable,
            {  // polyOptions
              strokeColor: '#000044',
              strokeOpacity: 0.5,
              strokeWeight: 6,
              clickable: false,
              zIndex: 5,
            }, null);
        reMap(this.navigableGeometry, map);
        reMap(oldGeometry, null);
      }

      // Update cursor position.
      var cursorPoint = this.model.get('cursorPoint');
      if (cursorPoint && cursorPoint.lat != null && cursorPoint.lng != null) {
        this.cursor.setPosition(
            new google.maps.LatLng(cursorPoint.lat, cursorPoint.lng));
        if (!this.cursorVisible)
          this.cursor.setMap(map);
        this.cursorVisible = true;
      } else {
        if (this.cursorVisible)
          this.cursor.setMap(null);
        this.cursorVisible = false;
      }

      // TODO: Create start/end markers from drive cycles.

      // endpoints
      // var imageA = new google.maps.MarkerImage('/graphics/black_MarkerA.png',
      //             new google.maps.Size(20.0, 34.0),
      //             new google.maps.Point(0, 0),
      //             new google.maps.Point(10.0, 34.0));

      // var imageB = new google.maps.MarkerImage('/graphics/black_MarkerB.png',
      //             new google.maps.Size(20.0, 34.0),
      //             new google.maps.Point(0, 0),
      //             new google.maps.Point(10.0, 34.0));

      // var shadow = new google.maps.MarkerImage('graphics/marker-shadow.png',
      //             new google.maps.Size(38.0, 34.0),
      //             new google.maps.Point(0, 0),
      //             new google.maps.Point(10.0, 34.0));

      // start = new google.maps.Marker({
      //   map: map,
      //   animation: google.maps.Animation.DROP,
      //   position: poly.getPath().getAt(0),
      //   icon: imageA,
      //   shadow: shadow,
      //   clickable: false,
      // });

      // end = new google.maps.Marker({
      //   map: map,
      //   animation: google.maps.Animation.DROP,
      //   position: poly.getPath().getAt(poly.getPath().getLength() - 1),
      //   icon: imageB,
      //   shadow: shadow,
      //   clickable: false,
      // });

      // TODO: should we avoid changing the map bounds if the user has dragged
      // the map?
      if (!this.visibleGeometry.bounds.isEmpty()) {
        this.mapBounds = this.visibleGeometry.bounds;
        map.fitBounds(this.mapBounds);
      }
      return this;
    },

    resize: function () {
      this._super('resize');
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
        if (this.mapBounds) {
          // this.map.fitBounds(this.mapBounds);
          // this.map.setCenter(this.mapBounds.getCenter());
        }
      }
    },

  });
});



// toMiles = function (m) {
//   return m / 1609.344;
// },
//
// showInfo = function () {
//   var distanceTxt = 'Distance traveled: ' + addCommas(distance.toFixed(2)) + ' m',
//       timeTxt = 'Cycle duration: ' + addCommas(((parseInt(times[times.length - 1]) - parseInt(times[0])) / 1000000 / 60).toFixed(2)) + ' min',
//       infoP = $('.map-info', wrap.parent()),
//       timeP = $('.map-time', wrap.parent());
//
//   // set text
//   infoP.html(distanceTxt + '<br/>' + timeTxt).show();
//
//   // offset time p
//   if (timeP.css('top') === infoP.css('top'))
//     timeP.css({ top: parseInt(timeP.css('top')) + infoP.height() + 12 });
// },
//
// hideInfo = function () {
//   $('.map-info', wrap.parent()).hide();
// };








