/*
 * Channels List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'util',
  'text!../../../templates/lists/channels.html',
  'collections/channels',
  'views/rows/channel'
], function ($, _, List, mps, util, template, Collection, Row, Spin) {
  return List.extend({

    el: '.channels',
    active: false,
    lineStyleOpen: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      //

      // Reset the collection.
      this.collection.reset(options.items);
    },

    setup: function () {

      // Do resize on window change.
      _.delay(_.bind(this.resizeAndFit, this), 250);
      $(window).resize(_.debounce(_.bind(this.resizeAndFit, this), 20));
      $(window).resize(_.debounce(_.bind(this.resizeAndFit, this), 150));
      $(window).resize(_.debounce(_.bind(this.resizeAndFit, this), 300));

      // Show this now.
      this.$el.show();

      // Handle last active style.
      _.delay(_.bind(function () {
        this.$('.channel.active:last').addClass('last-active');
      }, this), 1000);

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {

    },

    resizeAndFit: function (e) {
      this.resize(e);
      this.fit();
    },

    resize: function (e, active) {
      if (this.active || active
          || this.getChildrenHeight() > $('.graphs').height()) {
        this.$el.height($('.graphs').height() - 1);
      }
      else {
        this.$el.height('auto');
      }
    },

    fit: function () {
      w = this.parentView.$el.width() - 34;
      this.$el.width(w);
      this.$el.parent().width(w + 2);
      _.each(this.views, function (v) {
        v.fit(w);
      });
    },

    // the height of the channel list when it is expanded
    getChildrenHeight: function() {
      return _.foldl(this.views, function(memo, it) {
        return memo + it.$el.is(':visible') ? it.$el.height() : 0;
      }, 0);
    },

    // the height of the channel list when it is expanded
    getExpandedHeight: function() {
      return _.foldl(this.views, function(memo, it) {
        return memo + it.$el.height();
      }, 0);
    },

    expand: function (active) {
      if (this.$el.hasClass('open')) return;
      this.$el.addClass('open');
      var len = this.views.length;
      var el = this.$el;
      // We want the scrollbar to be outside the channellist, but overflow puts
      // it inside.  We add some padding to solve this issue
      if (this.getExpandedHeight() > ($('.graphs').height() - 1))
        el.parent().css('padding-right', '15px');
      _.each(this.views, function (v) { v.expand(); });
      this.$('.channel.active:last').removeClass('last-active');
      this.resize(null, active);
    },

    collapse: function (e) {
      if (!this.active && !this.lineStyleOpen) {
        var len = this.views.length;
        var el = this.$el;
        _.each(this.views, function (v) { v.collapse(); });
        this.$el.removeClass('open');
        this.$('.channel.active:last').addClass('last-active');
        _.delay(_.bind(function() { 
          this.resize();
          if (this.getChildrenHeight() <= $('.graphs').height()) {
            el.parent().css('padding-right', '0px');
          }
        }, this), 20);
      }
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
