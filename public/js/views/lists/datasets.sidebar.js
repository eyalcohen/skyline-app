/*
 * Sidebar Datasets List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/datasets.sidebar.html',
  'collections/datasets',
  'views/rows/dataset.sidebar'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.sidebar-datasets',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('dataset/new', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      this.app.rpc.socket.on('dataset.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('dataset.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.datasets.items);
    },

    events: {
      'click .add-data': 'add',
    },

    destroy: function () {
      if (this.modal) this.unpaginate();
      this.app.rpc.socket.removeAllListeners('dataset.new');
      this.app.rpc.socket.removeAllListeners('dataset.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (data.author.id === this.app.profile.user.id)
        this.collection.unshift(data);
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

    add: function (e) {
      e.preventDefault();

      // Render the finder view.
      mps.publish('modal/finder/open');
    },

  });
});
