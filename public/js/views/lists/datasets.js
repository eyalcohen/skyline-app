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
  'text!../../../templates/lists/datasets.html',
  'collections/datasets',
  'views/rows/dataset'
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
        mps.subscribe('chart/datasets/new', _.bind(this.collect, this)),
        mps.subscribe('channel/added', _.bind(this.channelAdded, this)),
        mps.subscribe('channel/removed', _.bind(this.channelRemoved, this)),
      ];

      // Socket subscriptions
      //

      // Reset the collection.
      var items = this.app.profile.content.datasets ?
          this.app.profile.content.datasets.items: [];
      var stored = store.get('state').datasets;
      items.sort(function(a, b) {
        return stored[a.id].index - stored[b.id].index;
      });
      this.collection.reset(items);
    },

    setup: function () {

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

      // Render the browser view.
      mps.publish('modal/browser/open', [true]);
    },

    added: function (d) {

      // Update state.
      var state = store.get('state');
      if (!state.datasets[d.id]) {
        state.datasets[d.id] = {index: _.size(state.datasets)};
        this.app.state(state);
      }

      // Fit tabs
      this.parentView.fit();
    },

    removed: function (d) {

      // Update state.
      var state = store.get('state');
      delete state.datasets[d.id];
      this.app.state(state);

      // Fit tabs
      this.parentView.fit();
    },

    collect: function (did) {

      // Get the dataset.
      rest.get('/api/datasets/' + did, _.bind(function (err, dataset) {
        if (err) {
          mps.publish('flash/new', [{
            message: err,
            level: 'error',
            sticky: true
          }]);
          return;
        }
        this.collection.push(dataset);
      }, this));
    },

    channelAdded: function (did, channel) {
      var state = store.get('state');
      if (!state.datasets[did].channels)
        state.datasets[did].channels = {};
      if (!state.datasets[did].channels[channel.channelName]) {
        state.datasets[did].channels[channel.channelName] = channel;
        this.app.state(state);
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
        ++index
        return v.model.id === data.id;
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
