/*
 * List view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util'
], function ($, _, Backbone, mps, util) {
  return Backbone.View.extend({

    initialize: function (app, options) {

      // Save app reference.
      this.app = app;

      // Grab options.
      options = options || {};

      // Save parent reference.
      this.parentView = options.parentView;

      // Default collection
      if (!this.collection) {
        this.collection = new Backbone.Collection({model: Backbone.Model});
      }
      this.collection.options = options;

      // List views
      this.views = [];

      // List events
      this.collection.on('reset', this.render, this);
      this.collection.on('add', this.renderLast, this);
      this.on('rendered', this.setup, this);
    },

    render: function (options) {
      this.collection.off('reset', this.reset, this);
      options = options || {};
      if (this.parentView && this.$el.attr('class')) {
        this.setElement(this.parentView.$('.' + _.str.strLeft(this.$el.attr('class'), ' ')));
      }
      if (this.template) {
        this.$el.html(this.template(_.extend(options, {util: util})));
      }
      this.trigger('rendered');
      return this;
    },

    renderLast: function (pagination) {
      if (this.collection.models.length === 1) {
        this.$('.empty-feed').hide();
        this.$('.full-feed').hide();
      }
      if (pagination !== true && this.collection.options &&
          this.collection.options.reverse) {
        this.row(this.collection.models[0]);
        this.views[0].render(true, true);
      } else {
        this.row(this.collection.models[this.collection.models.length - 1],
            pagination);
        this.views[this.views.length - 1].render(true);
      }
      return this;
    },

    setup: function () {
      this.off('rendered', this.setup, this);
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    row: function (model, pagination) {
      var view = new this.Row({
        parentView: this,
        model: model
      }, this.app);
      if (pagination !== true
          && this.collection.options && this.collection.options.reverse) {
        this.views.unshift(view);
      } else {
        this.views.push(view);
      }
      return view.toHTML();
    },

    unselect: function () {
      this.$('.selected').removeClass('selected');
    },

  });
});
