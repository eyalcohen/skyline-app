/*
 * Channels List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/channels.html',
  'collections/channels',
  'views/rows/channel'
], function ($, _, List, mps, rpc, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: 'div.channels',
    working: false,
    active: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      console.log(options.items.length)
      this.subscriptions = [
        mps.subscribe('channel/added', _.bind(this.added, this)),
        mps.subscribe('channel/removed', _.bind(this.removed, this)),
      ];

      // Socket subscriptions
      //

      // Reset the collection.
      this.collection.reset(options.items);
    },

    setup: function () {

      // Do resize on window change.
      _.delay(_.bind(this.resize, this), 250);
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      $(window).resize(_.debounce(_.bind(this.resize, this), 150));
      $(window).resize(_.debounce(_.bind(this.resize, this), 300));

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      
    },

    resize: function (active) {
      if (this.active || active)
        this.$el.height($('div.graphs').height());
      else
        this.$el.height('auto');
    },

    added: function (channel) {
      if (!_.find(this.views, function (v) {
        return v.model.id === channel.channelName;
      })) return;
      //
    },

    removed: function (channel) {
      if (!_.find(this.views, function (v) {
        return v.model.id === channel.channelName;
      })) return;
      //
    },

    expand: function (active) {
      _.each(this.views, function (v) { v.expand(); });
      this.resize(active);
    },

    collapse: function () {
      if (!this.active)
        _.each(this.views, function (v) { v.collapse(); });
      this.resize();
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
