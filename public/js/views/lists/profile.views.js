/*
 * Profile Views List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/profile.views.html',
  'collections/views',
  'views/rows/profile.view'
], function ($, _, List, mps, rest, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.profile-views',

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

      // Misc.
      this.emptyLabel = 'You don\'t have any yet!';

      // Reset the collection.
      this.collection.reset(options.views.items);
    },

    // Initial bulk render of list.
    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length === 0)
        $('<span class="empty-feed">' + this.emptyLabel + '</span>')
            .appendTo(this.$el);
      return this;
    },

    setup: function () {
      return List.prototype.setup.call(this);
    },

    events: {},

    collect: function (data) {
      var user_id = this.parentView.model ?
          this.parentView.model.id: this.app.profile.user.id;
      if (data.author.id === user_id)
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
          if (this.collection.length === 0
              && this.$('.empty-feed').length === 0)
            $('<span class="empty-feed">' + this.emptyLabel + '</span>')
                .appendTo(this.$el);
        }, this));
      }
    },

  });
});
