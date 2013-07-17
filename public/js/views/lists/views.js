/*
 * Views List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/views.html',
  'collections/views',
  'views/rows/view'
], function ($, _, List, mps, rpc, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.views',
    working: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('view.new', _.bind(this.collect, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.views.items);
    },

    setup: function () {

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      
    },

    // Collect new views from socket events.
    collect: function (view) {
      if (view.author.id === this.parentView.model.id)
        this.collection.unshift(view);
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove();
        this.collection.remove(view.model);
      }
    },

  });
});
