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
        disableDefaultUI: true,
        mapTypeControlOptions: {
          mapTypeIds: [ google.maps.MapTypeId.ROADMAP, 'greyscale' ],
        },
      };
      var map = this.map =
          new google.maps.Map($('.map', this.content).get(0), options);
      map.mapTypes.set('grayscale',
          new google.maps.StyledMapType(style.stylez, style.styledOptions));
      map.setMapTypeId('grayscale');

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
          //map.setCenter(mapBounds.getCenter());
          //map.fitBounds(mapBounds);
          //wrap.removeClass('map-tmp');
          //showInfo();
        // }
      });
    },

    draw: function (options) {
      if (mapsLoadNotifier) {
        // Maps is not yet loaded - delay drawing until it's available.
        console.log('Deferring map draw.');
        mapsLoadNotifier.bind('load', _.bind(this.draw(options), this));
        return;
      }

      options = options || {};
      if (!this.map)
        this.createMap();
      var map = this.map;
      console.log('Drawing map.');

      function unMap(geometry) {
        if (!geometry) return;
        function unmap(p) { p.setMap(null); }
        geometry.polys.forEach(unmap);
        geometry.dots.forEach(unmap);
      };

      var bounds = new google.maps.LatLngBounds();

      function pointsToGeometry(points, polyOptions, dotOptions) {
        var geometry = { polys: [], dots: [] };
        var pendingPoly = [];
        console.log('LatLng points: ' + points.length);
        function newPoly() {
          if (pendingPoly.length > 1)
            geometry.polys.push(new google.maps.Polyline(
                _.extend({ map: map, path: pendingPoly }, polyOptions)));
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
                _.extend({ map: map, center: ll }, dotOptions)));
          */
          bounds.extend(ll);
        });
        newPoly();
        console.log('Poly count: ' + geometry.polys.length);
        return geometry;
      };

      // Create the visisble points geometry.
      if (options.pointsVisibleChanged) {
        var oldGeometry = this.visibleGeometry;
        this.visibleGeometry = pointsToGeometry(this.model.get('pointsVisible'),
            {  // polyOptions
              strokeColor: '#0000ff',
              strokeOpacity: 0.4,
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
        // UnMap after rendering new line to avoid flickering.
        unMap(oldGeometry);
      }

      // Create the navigable points geometry.
      if (options.pointsNavigableChanged) {
        unMap(this.navigableGeometry);
        // TODO: remove visible points time range from navigable points?
        this.navigableGeometry = pointsToGeometry(
            this.model.get('pointsNavigable'),
            {  // polyOptions
              strokeColor: '#ff0000',
              strokeOpacity: 0.6,
              strokeWeight: 6,
              clickable: false,
              zIndex: 5,
            }, null);
      }

      // TODO: cell dots?
      // cellDotStyle = {
      //   strokeWeight: 0,
      //   fillColor: "#ff00ff",
      //   fillOpacity: 0.5,
      //   radius: 50,
      //   clickable: false,
      // },

      // TODO: Create start/end markers from drive cycles.

      // cursor
      // cursor = new google.maps.Marker({
      //   map: map,
      //   animation: google.maps.Animation.DROP,
      //   position: poly.getPath().getAt(0),
      //   icon: 'http://google-maps-icons.googlecode.com/files/car.png',
      //   zIndex: 1000001,
      //   clickable: false,
      // });

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
      map.fitBounds(bounds);
      this.mapBounds = bounds;
      return this;
    },

    resize: function () {
      this._super('resize');
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
        // this.map.fitBounds(this.mapBounds);
        // this.map.setCenter(mapBounds.getCenter());
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








