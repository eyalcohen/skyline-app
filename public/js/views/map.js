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
    api_key: 'e2c51af30080afb68c9c7702c2e20f7d5f2cd506',
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
      this.pre = "select *, st_asgeojson(the_geom) as geometry from " + this.table;
    },

    render: function (time) {
      this.time = time;

      // Init css template.
      this.cssTemplate = _.template(css);

      // Init the load indicator.
      this.spin = new Spin(this.parentView.$('.map-spin'),
          {color: '#8f8f8f', lines: 13, length: 3, width: 2, radius: 6});
      this.spin.start();

      this.channels = [];
      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Setup the base map.
      this.sql = new cartodb.SQL({user: 'skyline', api_key: this.api_key});
      this.map = new L.Map('map_inner', {
        center: [0,0],
        zoom: 2,
        minZoom: 2
      });

      // Add a base tile layer.
      L.tileLayer('http://{s}.{base}.maps.cit.api.here.com/maptile/2.1/' +
          'maptile/{mapID}/{variant}/{z}/{x}/{y}/256/png8?' +
          'app_id={app_id}&app_code={app_code}', {
        attribution:
            'Map &copy; 1987-2014 <a href="http://developer.here.com">HERE</a>',
        subdomains: '1234',
        mapID: 'newest',
        'app_id': 'PvVIz1964Y3C1MabyVqB',
        'app_code': 'yuYSbxg5Z5b2c594mYfLtA',
        base: 'base',
        variant: 'normal.day',
        minZoom: 0,
        maxZoom: 20
      }).addTo(this.map);

      // Create the data layer.
      cartodb.createLayer(this.map, {
        user_name: 'skyline',
        type: 'cartodb',
        https: true,
        extra_params: {
          map_key: this.api_key,
        },
        sublayers: [{
          sql: this.pre + " limit 0",
          cartocss: this.cssTemplate.call(this),
          interactivity: 'cartodb_id,geometry,id,tb,te'
        }]
      })
      .addTo(this.map)
      .done(_.bind(function (layer) {
        this.dataLayer = layer.getSubLayer(0);

        this.dataLayer.bind('featureOver', _.bind(this.featureOver, this));
        this.dataLayer.bind('featureOut', _.bind(this.featureOut, this));
        this.dataLayer.setInteraction(true);

        this.refresh();
        this.updateVisibleTime();
        this.spin.stop();
      }, this));
    },

    events: {},

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    featureOver: function (e, pos, latlng, data, fromMap) {
      if (this.point) {
        if (data.cartodb_id === this.point.cartodb_id) {
          return;
        }
        this.map.removeLayer(this.point);
        this.point.cartodb_id = data.cartodb_id;
      }
      this.point = new L.GeoJSON(JSON.parse(data.geometry), {
        pointToLayer: function (feature, latlng) {
          return new L.CircleMarker(latlng, {
            color: '#333',
            weight: 1.5,
            fillColor: '#27CDD6',
            fillOpacity: 0.3,
            clickable: false
          }).setRadius(12);
        }
      }).addTo(this.map);

      if (!fromMap) {
        if (data.tb > this.time.beg && data.te < this.time.end) {
          this.parentView.updateCursor(null, data.tb / 1e3);
        } else {
          this.parentView.hideCursor();
        }
      }
    },

    featureOut: function() {
      $(this.map.getContainer()).css('cursor', 'auto');
      if (this.point) {
        this.map.removeLayer(this.point);
        this.point.cartodb_id = null;
      }
    },

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
      if (time) {
        if (time.beg === this.time.beg
            && time.end === this.time.end) {
          return;
        }
        this.time = time;
      }
      if (this.dataLayer) {
        this.dataLayer.setCartoCSS(this.cssTemplate.call(this));
      }
    },

    updateCursor: function (cursor) {
      if (!this.dataLayer || !this.data) return;
      var t = _.isNumber(cursor) ? cursor: cursor[0].nearestPointData[0] * 1e3;
      if (t === this.cursorTime) {
        return;
      }
      this.cursorTime = t;
      if (this.data.rows.length === 0) {
        return;
      }
      var point;
      var dt = Number.MAX_VALUE;
      _.each(this.data.rows, function (p) {
        var _dt = Math.abs(p.tb - t);// + Math.abs(p.te - t)) / 2;
        if (_dt < dt) {
          dt = _dt;
          point = p;
        }
      });
      
      this.featureOver(null, null, null, point, true);
    },

    refresh: function () {
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
      var query = this.pre;
      if (this.dids.length === 0) {
        query += " limit 0";
        this.map.fitWorld({animate: true});
      } else {
        query += " where ";
        _.each(this.dids, _.bind(function (id, i) {
          query += "id = " + id;
          if (i !== this.dids.length - 1) {
            query += " OR ";
          }
        }, this));
        this.sql.getBounds(query).done(_.bind(function (bounds) {
          this.map.fitBounds(bounds, {animate: true});
        }, this));
      }

      // Update.
      this.dataLayer.setSQL(query);
      this.sql.execute(query).done(_.bind(function (data) {
        this.data = data;
        if (this.data.rows.length > 0) {
          this.parentView.mapButton.addClass('active');
        } else {
          this.parentView.mapButton.removeClass('active');
        }
      }, this))
      this.query = query;
    },

    resize: function (width, fit) {
      if (!this.map) {
        return;
      }
      var sizer = setInterval(_.bind(function () {
        this.map.invalidateSize();
        if (this.$el.width() + 1 >= width) {
          clearInterval(sizer);
        }
      }, this), 20);
      if (fit && this.query) {
        this.sql.getBounds(this.query).done(_.bind(function (bounds) {
          this.map.fitBounds(bounds, {animate: true});
        }, this));
      }
    }

  });
});
