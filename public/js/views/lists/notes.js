/*
 * Notes List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/notes.html',
  'collections/notes',
  'views/rows/note'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.notes',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('note.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('note.removed', _.bind(this._remove, this));

      this.collection.reset(this.parentView.model.get('notes'));
    },

    setup: function () {

      // Save refs.
      this.footer = this.$('.list-footer');

      return List.prototype.setup.call(this);
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      this.checkEmpty();
      return this;
    },

    destroy: function () {
      // this.app.rpc.socket.removeAllListeners('note.new');
      // this.app.rpc.socket.removeAllListeners('note.removed');
      return List.prototype.destroy.call(this);
    },

    // Bind mouse events.
    events: {},

    // Collect new data from socket events.
    collect: function (data) {
      if (data.parent_id === this.parentView.model.id) {
        this.collection.unshift(data);
        this.checkEmpty();
      }
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
          this.checkEmpty();
        }, this));
      }
    },

    checkEmpty: function () {
      if (this.collection.length === 0) {
        $('<span class="empty-feed">No notes.</span>').appendTo(this.$el);
      } else {
        this.$('.empty-feed').remove();
      }
    }

  });
});
