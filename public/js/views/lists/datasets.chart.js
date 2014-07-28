/*
 * Datasets List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/datasets.chart.html',
  'collections/datasets',
  'views/rows/dataset.chart'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({

    el: '.datasets',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Do work when items are added or removed.
      this.collection.on('add', _.bind(this.added, this));
      this.collection.on('remove', _.bind(this.removed, this));

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('dataset/select', _.bind(this.collect, this)),
        mps.subscribe('channel/request', _.bind(this.channelRequest, this)),
        mps.subscribe('channel/added', _.bind(this.channelAdded, this)),
        mps.subscribe('channel/removed', _.bind(this.channelRemoved, this)),
      ];

      // Reset the collection.
      var items = this.app.profile.content.datasets ?
          this.app.profile.content.datasets.items: [];
      var stored = store.get('state').datasets;
      items = _.reject(items, function (i) {
        return !_.find(store.get('state').datasets,
            function (d, did) { return Number(i.id) === Number(did); });
      });
      items.sort(function (a, b) {
        return stored[a.id].index - stored[b.id].index;
      });
      this.collection.reset(items);
    },

    setup: function () {

      // Ensure index order.
      this.sort();

      // Save refs.
      this.button = this.$('.dataset-add-button');

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      'click .dataset-add-button': 'add'
    },

    add: function (e) {
      e.preventDefault();

      // Render the finder view.
      mps.publish('modal/finder/open', [true]);
    },

    added: function (d) {

      // Update profile content.
      this.app.profile.content.datasets.items.push(d.attributes);

      // Update state.
      var state = store.get('state');
      if (!state.datasets[d.id]) {
        state.datasets[d.id] = {index: _.size(state.datasets)};
        this.app.state(state);
      }
      this.sort();

      // Fit tabs
      this.parentView.fit();

      // Notify.
      mps.publish('dataset/added');

      // For rendering new tooltips
      this.$('.tooltip').tooltipster({delay: 600, multiple: true});
    },

    removed: function (d) {

      // Update profile content.
      this.app.profile.content.datasets.items =
          _.reject(this.app.profile.content.datasets.items, function (s) {
        return Number(s.id) === Number(d.id);
      });

      // Update state.
      var state = store.get('state');
      delete state.datasets[d.id];
      this.app.state(state);
      this.sort();

      // Fit tabs
      this.parentView.fit();

      // Notify.
      mps.publish('dataset/added');
    },

    // Ensure dataset indexes are correct.
    sort: function () {
      var state = store.get('state');
      _.each(state.datasets, _.bind(function (sd, id) {
        var i = -1;
        _.find(this.app.profile.content.datasets.items, function (d) {
          ++i;
          return Number(id) === Number(d.id);
        });
        sd.index = i;
      }, this));
      store.set('state', state);
    },

    collect: function (did) {

      // Get the dataset.
      rest.get('/api/datasets/' + did, _.bind(function (err, dataset) {
        if (err) {
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }]);
          return;
        }
        this.collection.push(dataset);
      }, this));
    },

    channelRequest: function (did, channelName, cb) {
      var channel;
      _.each(this.views, function (v) {
        if (v.model.id !== did) return;
        channel = _.find(v.channels.collection.models, function (c) {
          return c.id === channelName;
        });
      });
      cb(channel);
    },

    channelAdded: function (did, channel, lineStyle, silent) {
      var state = store.get('state');
      if (!state.datasets) {
        state.datasets = {};
      }
      if (!state.datasets[did]) {
        state.datasets[did] = {};
      }
      if (!state.datasets[did].channels) {
        state.datasets[did].channels = {};
      }
      if (!state.datasets[did].channels[channel.channelName]) {
        state.datasets[did].channels[channel.channelName] = channel;
        this.app.state(state, silent);
      }
    },

    channelRemoved: function (did, channel) {
      var state = store.get('state');
      delete state.datasets[did].channels[channel.channelName];
      if (_.isEmpty(state.datasets[did].channels))
        delete state.datasets[did].channels;
      this.app.state(state);
    },

    fit: function (w) {
      var _w = Math.floor((w - this.button.outerWidth()) /
          this.collection.length);
      _.each(this.views, function (v) {
        v.fit(_w);
      });
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return Number(v.model.id) === Number(data.id);
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
        }, this));
      }
    },

  });
});
