/*
 * Map view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/carto/samples.css'
], function ($, _, Backbone, mps, rest, util, Spin, css) {
  return Backbone.View.extend({

    el: '.map-inner',
    channels: [],
    dids: [],
    cursorTime: 0,

    initialize: function (app, options) {
      this.app = app;
      this.parentView = options.parentView;
      this.subscriptions = [
        mps.subscribe('channel/mousemove', _.bind(this.updateCursor, this))
      ];
      this.on('rendered', this.setup, this);

      this.table = window.__s ? 'samples': 'samples_dev';
    },

    render: function (time) {
      this.time = time;

      // Init css template.
      this.cssTemplate = _.template(css);

      // Init the load indicator.
      this.spin = new Spin(this.parentView.$('.map-spin'),
          {color: '#8f8f8f', lines: 13, length: 3, width: 2, radius: 6});
      // this.spin.start();

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Setup the base map.
      // var sql = new cartodb.SQL({user: 'skyline', format: 'geojson'});

      // var polygons = {};

      var map = new L.Map('map_inner', {
        center: [0,0],
        zoom: 2
      });

      L.tileLayer('https://dnv9my2eseobd.cloudfront.net/v3/cartodb.map-4xtxp73f/{z}/{x}/{y}.png', {
        attribution: 'Mapbox <a href="http://mapbox.com/about/maps" target="_blank">Terms & Feedback</a>'
      }).addTo(map);

      cartodb.createLayer(map, {
        user_name: 'skyline',
        type: 'cartodb',
        sublayers: [{
          sql: "SELECT * FROM samples_dev",
          cartocss: '#crags {marker-fill: #F0F0F0;}'
        }]
      })
      .addTo(map)
      .done(function (layer) {

      });

      // cartodb.createLayer(map, {
      //   user_name: 'skyline',
      //   type: 'cartodb',
      //   sublayers: [{
      //     sql: "select * from lower_48_zips",
      //     cartocss: '#lower_48_zips{ polygon-fill: #CCCCCC; polygon-opacity: 0.7; line-width: 0.5; line-color: #333333; line-opacity: 0.3;}',
      //     interactivity: 'cartodb_id'
      //   }]
      // }).done(function(layer) {
      //   map.addLayer(layer);
      //   layer.getSubLayer(0).setInteraction(true);
      //   // geometryClick('andrew', map, layer.getSubLayer(0));
      //   // addCursorInteraction(layer);
      // });

      // cartodb.createLayer(map, 'https://skyline.cartodb.com/api/v2/viz/' + this.table + '/viz.json')
      //   .addTo(map)
      //   .on('done', _.bind(function (layer) {
      //     layer = layer.getSubLayer(0);

      //     var HIGHLIGHT_STYLE = {
      //       weight: 3,
      //       color: '#FFFFFF',
      //       opacity: 1,
      //       fillColor: '#FFFFFF',
      //       fillOpacity: 0.3
      //     };
      //     var style = HIGHLIGHT_STYLE;
      //     var polygonsHighlighted = [];

      //     sql.execute("select * from samples_dev").done(function (geojson) {
      //       var features = geojson.features;
      //       for (var i = 0; i < features.length; ++i) {
      //         var f = geojson.features[i];
      //         var key = f.properties.cartodb_id;

      //         // Generate geometry.
      //         var geo = L.GeoJSON.geometryToLayer(features[i].geometry);
      //         console.log(geo);
      //         geo.setStyle(style);

      //         // Add to polygons.
      //         polygons[key] = polygons[key] ||  [];
      //         polygons[key].push(geo);
      //       }
      //     });

      //     function featureOver(e, pos, latlng, data) {
      //       featureOut();
      //       var pol = polygons[data.cartodb_id] || [];
      //       for(var i = 0; i < pol.length; ++i) {
      //         map.addLayer(pol[i]);
      //         polygonsHighlighted.push(pol[i]);
      //       }
      //     }

      //     function featureOut() {
      //       var pol = polygonsHighlighted;
      //       for(var i = 0; i < pol.length; ++i) {
      //         map.removeLayer(pol[i]);
      //       }
      //       polygonsHighlighted = [];
      //     }

      //     layer.on('featureOver', featureOver);
      //     layer.on('featureOut', featureOut);
      //     layer.setInteraction(true);

      //     this.spin.stop();
      //   }, this));



      // cartodb.createVis('map_inner',
      //     'https://skyline.cartodb.com/api/v2/viz/' + this.table + '/viz.json', {
      //   tiles_loader: true,
      //   scrollwheel: true,
      //   https: true
      // })
      // .done(_.bind(function (vis, layers) {
      //   this.vis = vis;
      //   this.baseLayer = layers[0];
      //   this.dataLayer = layers[1].getSubLayer(0);
      //   this.dataLayer.setInteraction(true);

      //   // Handle mouse interaction.
      //   this.dataLayer.bind('featureOver',
      //       _.bind(function (e, latlng, pos, data, subLayerIndex) {
      //     this.vis.mapView.setCursor('pointer');
      //     if (data.tb >= this.time.beg && data.te <= this.time.end) {
      //       this.parentView.updateCursor(null, data.tb / 1e3);
      //       // this.updateCursor(data.tb);
      //     }
      //   }, this));
      //   this.dataLayer.bind('featureOut',
      //       _.bind(function (e, latlng, pos, data, subLayerIndex) {
      //     this.vis.mapView.setCursor('hand');
      //   }, this));

      //   this.refresh();
      //   this.updateVisibleTime();
      //   this.spin.stop();
      // }, this));
    },

    events: {},

    addChannel: function (channel) {
      this.channels.push(channel);
      this.refresh();
    },

    removeChannel: function (channel) {
      this.channels = _.reject(this.channels, function (c) {
        return c.channelName === channel.channelName;
      });
      this.refresh();
    },

    updateVisibleTime: function (time) {
      if (!this.dataLayer) return;
      if (time) {
        if (time.beg === this.time.beg
            && time.end === this.time.end) {
          return;
        }
        this.time = time;
      }

      // this.dataLayer.setCartoCSS(this.cssTemplate.call(this));
    },

    updateCursor: function (cursor) {
      return;
      if (!this.dataLayer) return;

      var t = _.isNumber(cursor) ? cursor: cursor[0].nearestPointData[0] * 1e3;
      if (t === this.cursorTime) {
        return;
      }
      this.cursorTime = t;
      this.dataLayer.setCartoCSS(this.cssTemplate.call(this));
    },

    refresh: function () {
      return;
      if (!this.dataLayer) return;

      // Get dataset ids from channels.
      var dids = [];
      _.each(this.channels, function (c) {
        if (!_.contains(dids, c.did)) {
          dids.push(c.did);  
        } 
      });
      if (dids.length === this.dids.length) {
        return;
      }
      this.dids = dids;

      // Write the query.
      var query = "select * from " + this.table + " where ";
      if (this.dids.length === 0) {
        query += "id = 0";
        this.vis.mapView.map_leaflet.fitWorld({animate: true});
      } else {
        _.each(this.dids, _.bind(function (id, i) {
          query += "id = " + id;
          if (i !== this.dids.length - 1) {
            query += " OR ";
          }
        }, this));
        this.sql.getBounds(query).done(_.bind(function (bounds) {
          this.vis.mapView.map_leaflet.fitBounds(bounds, {animate: true});
        }, this));
      }

      // var HIGHLIGHT_STYLE = {
      //       weight: 3,
      //       color: '#FFFFFF',
      //       opacity: 1,
      //       fillColor: '#FFFFFF',
      //       fillOpacity: 0.3
      //     };
      //     style = options.style || HIGHLIGHT_STYLE;
      //     var polygonsHighlighted = [];

      sql.execute(query).done(function (geojson) {
        var features = geojson.features;
        for (var i = 0; i < features.length; ++i) {
          var f = geojson.features[i];
          var key = f.properties.cartodb_id;

          // generate geometry
          var geo = L.GeoJSON.geometryToLayer(features[i].geometry);
          geo.setStyle(style);

          // add to polygons
          polygons[key] = polygons[key] ||  [];
          polygons[key].push(geo);
        }
      });


      // this.dataLayer.setSQL(query);
    },

    resize: function (width) {
      if (!this.vis) {
        return;
      }
      var sizer = setInterval(_.bind(function () {
        this.vis.mapView.map_leaflet.invalidateSize();
        if (this.$el.width() >= width) {
          clearInterval(sizer);
        }
      }, this), 20);
    }

  });
});
