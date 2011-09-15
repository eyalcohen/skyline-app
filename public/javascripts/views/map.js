/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'map_style', 'async!http://maps.google.com/maps/api/js?'+
    'libraries=geometry&sensor=false!callback'], 
    function (DashItemView, style) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
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
      if (!this.firstRender && !opts.loading && !opts.empty) {
        this.draw();
      }
      return this;
    },

    draw: function () {
      var points = this.model.attributes.points,
          gpsPoints = {},
          cellPoints = {},
          timeBounds,
          times = [],
          minlat = 90,
          maxlat = -90,
          minlng = 180,
          maxlng = -180,
          map,
          mapWidth = this.content.width(),
          mapHeight = 400,
          mapOptions = {
            disableDefaultUI: true,
            mapTypeControlOptions: {
              mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'greyscale'],
            },
          },
          mapType = new google.maps.StyledMapType(style.stylez, style.styledOptions),
          poly = new google.maps.Polyline({
            strokeColor: '#000000',
            strokeOpacity: 0.6,
            strokeWeight: 8,
            clickable: false,
          }),
          distance,
          dots = [],
          cellDots = [],
          dotStyle = {
            strokeWeight: 0,
            fillColor: "#ffffff",
            fillOpacity: 0.5,
            radius: 10,
            clickable: false,
          },
          cellDotStyle = {
            strokeWeight: 0,
            fillColor: "#ff00ff",
            fillOpacity: 0.5,
            radius: 50,
            clickable: false,
          },
          start,
          end,
          cursor,
          // firstRun = true,
          loadedHandle,
          dragHandle,
          leaveHandle;

      for (var i = 0, len = points.length; i < len; i++) {
        var time = points[i].beg,
            lat = points[i].lat,
            lng = points[i].lng;
        if (lat < minlat) minlat = lat;
        if (lat > maxlat) maxlat = lat;
        if (lng < minlng) minlng = lng;
        if (lng > maxlng) maxlng = lng;
        var ll = new google.maps.LatLng(lat, lng),
            d = new google.maps.Circle(dotStyle);
        d.setCenter(ll);
        dots.push(d);
        poly.getPath().push(ll);
        gpsPoints[time] = ll;
      }

      // make array of times
      // times = Object.keys(gpsPoints);

      // get path length
      distance = google.maps.geometry.spherical.computeLength(poly.getPath());

      // make map bounds
      var sw = new google.maps.LatLng(minlat, minlng),
          ne = new google.maps.LatLng(maxlat, maxlng),
          mapBounds = new google.maps.LatLngBounds(sw, ne);

      // make new map
      map = new google.maps.Map($('.map', this.content).get(0), mapOptions);
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
      var imageA = new google.maps.MarkerImage('/graphics/black_MarkerA.png',
                  new google.maps.Size(20.0, 34.0),
                  new google.maps.Point(0, 0),
                  new google.maps.Point(10.0, 34.0));

      var imageB = new google.maps.MarkerImage('/graphics/black_MarkerB.png',
                  new google.maps.Size(20.0, 34.0),
                  new google.maps.Point(0, 0),
                  new google.maps.Point(10.0, 34.0));

      var shadow = new google.maps.MarkerImage('graphics/marker-shadow.png',
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
        //$('.map-time', wrap.parent()).show();
      });

      // clear plot when leave map
      leaveHandle = google.maps.event.addListener(map, 'mouseout', function (e) {

        // notify sandbox
        //box.notify('cs-map-cursorout');

        // hide time
        //$('.map-time', wrap.parent()).hide();
      });

      // move cursor on mouse hover
      // dragHandle = google.maps.event.addListener(map, 'mousemove', function (e) {
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
      loadedHandle = google.maps.event.addListener(
            map, 'tilesloaded', function () {
        // if (firstRun) {
          // firstRun = false;
          google.maps.event.trigger(map, 'resize');
          map.setCenter(mapBounds.getCenter());
          map.fitBounds(mapBounds);
          //wrap.removeClass('map-tmp');
          //showInfo();
        // }
      });

      this.map = map;
      this.mapBounds = mapBounds;
      return this;
    },

    resize: function () {
      this._super('resize');
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
        this.map.fitBounds(this.mapBounds);
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








