/*
 * Sidebar Views List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/views.other.sidebar.html',
  'collections/views',
  'views/rows/view.sidebar'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.sidebar-views2',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('view/new', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      this.app.rpc.socket.on('view.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('view.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.views.other.items);
    },

    setup: function () {

      // Save refs.
      this.count = this.$('.sidebar-heading-cnt');
      this.tip = this.$('.sidebar-tip');

      this.updateCount();
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.app.rpc.socket.removeAllListeners('view.new');
      this.app.rpc.socket.removeAllListeners('view.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      var id = this.parentView.model ? this.parentView.model.id:
          this.app.profile.user.id;
      var hasOwn = _.find(data.datasets, function (d) {
        return _.find(d.channels, function (c) {
          return c.author_id === id;
        });
      });
      if (data.author.id !== id && hasOwn) {
        this.collection.unshift(data);
        this.updateCount();
      }
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
          this.updateCount();
        }, this));
      }
    },

    updateCount: function () {
      if (!this.parentView.model
          || (this.app.profile.user
          && this.parentView.model.id === this.app.profile.user.id)) {
        if (this.collection.length === 0) {
          this.tip.show();
        } else {
          this.tip.hide();
        }
      }
      this.count.text('(' + this.collection.length + ')');
    },

  });
});
