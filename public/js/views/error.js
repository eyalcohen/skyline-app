/*
 * Page view for errors.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/error',
  'text!../../templates/error.html',
], function ($, _, Backbone, mps, util, Model, template) {
  return Backbone.View.extend({

    className: 'error',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];

      this.on('rendered', this.setup, this);
    },

    render: function (error) {
      this.model = new Model(error);
      this.app.title('Oops');
      this.template = _.template(template);

      if ($('.main').length > 0) {
        this.$el.html(this.template.call(this)).appendTo('.main');
      } else {
        this.$el.html(this.template.call(this)).appendTo('.container');
      }

      this.trigger('rendered');
      return this;
    },

    setup: function () {
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    events: {},

  });
});
