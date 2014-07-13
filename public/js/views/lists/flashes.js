/*
 * Flash Messages List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/flashes.html',
  'collections/flashes',
  'views/rows/flash'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '.block-messages > ul',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Socket subscriptions
      if (this.app.profile && this.app.profile.user) {
        this.app.rpc.socket.on(this.app.profile.user.id + '.flash.new',
            _.bind(this.collect, this));
      }

      // Shell subscriptions:
      mps.subscribe('flash/new', _.bind(function (data, clear) {
        if (clear) {
          this.collection.reset([]);
          _.each(this.views, function (v) {
            v.destroy();
          });
          this.views = [];
        }
        this.collection.push(data);
      }, this));

      mps.subscribe('flash/clear', _.bind(function () {
        this.collection.reset([]);
        _.each(this.views, function (v) {
          v.destroy();
        });
        this.views = [];
      }, this));

      // Call super init.
      List.prototype.initialize.call(this, app, options);
    },

    // collect new flashes from socket events.
    collect: function (data) {
      this.collection.push(data);
    },

    // remove a model
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
