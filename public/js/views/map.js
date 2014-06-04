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
  'text!../../templates/popup.html'
], function ($, _, Backbone, mps, rest, util, Spin, popup) {
  return Backbone.View.extend({

    el: '.map-inner',
    channels: [],
    dids: [],

    initialize: function (app, options) {
      this.app = app;
      this.parentView = options.parentView;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {

      // Init the load indicator.
      this.spin = new Spin(this.parentView.$('.map-spin'),
          {color: '#8f8f8f', lines: 13, length: 3, width: 2, radius: 6});
      this.spin.start();

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Setup the base map.
      this.sql = new cartodb.SQL({user: 'skyline'});
      this.map = cartodb.createVis('map_inner',
          'https://skyline.cartodb.com/api/v2/viz/samples/viz.json', {
        tiles_loader: true,
        scrollwheel: true,
        https: true
      })
      .done(_.bind(function (vis, layers) {
        this.vis = vis;
        this.baseLayer = layers[0];
        this.dataLayer = layers[1].getSubLayer(0);
        this.refresh();
        this.spin.stop();
      }, this));
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

    refresh: function () {
      if (!this.dataLayer) return;

      // Get dataset ids from channels.
      this.dids = [];
      _.each(this.channels, _.bind(function (c) {
        if (!_.contains(this.dids, c.did)) {
          this.dids.push(c.did);  
        } 
      }, this));

      // Write the query.
      var query = "select * from samples where ";
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
      this.dataLayer.setSQL(query);
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
