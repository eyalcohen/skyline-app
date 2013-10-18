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
], function ($, _, List, mps, rest, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.datasets',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('chart/datasets/add', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      //

      // Reset the collection.
      var items = this.app.profile.content.datasets ?
          this.app.profile.content.datasets.items: [];
      this.collection.reset(items);
    },

    setup: function () {
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
