/*
 * Small line style modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'util',
  'text!../../../templates/linestyle.html',
], function ($, _, Backbone, Modernizr, mps, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;
      this.$el = this.options.parentView.$el;
      this.channel = this.options.channel;

      // Shell events.
      this.on('rendered', this.setup, this);

      this.subscriptions = [
        mps.subscribe('channel/responseLineStyle', _.bind(this.responseLineStyle, this)),
      ];
    },

    // Draw the template
    render: function () {
      this.template = _.template(template, {channels: this.channels});
      this.$el.append(this.template);
      // once rendered, we change the $el refernece to the newly created modal
      this.$el = $('.linestyle-modal');
      this.$el.show('fast');
      this.trigger('rendered');
      return this;
    },

    // Bind events.
    events: {
      'click .linestyle-linetype *' : 'linetypeUpdate',
    },

    // Misc. setup.
    setup: function () {
      mps.publish('channel/requestLineStyle', [this.channel.id]);
      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function (cb) {
      this.undelegateEvents();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.stopListening();
      this.$el.hide('fast', function () {
        this.remove();
        cb();
      });
    },

    linetypeUpdate: function(e) {
      lineStyleOptions = {
        showPoints: true,
        showLines: true,
        interpolation: 'linear' // also 'none'
      }
      var target = e.target.className;

      if (target === 'linestyle-scatter') {
        lineStyleOptions.showPoints = true;
        lineStyleOptions.showLines = false;
      } else if (target === 'linestyle-line') {
        lineStyleOptions.showPoints = false;
        lineStyleOptions.showLines = true;
      } else if (target === 'linestyle-line-with-points') {
        lineStyleOptions.showPoints = true;
        lineStyleOptions.showLines = true;
      }
      this.unselected($('.linestyle-linetype').children())
      this.selected('.' + target);
      mps.publish('channel/lineStyleUpdate', [this.channel.id, lineStyleOptions]);
    },

    responseLineStyle: function(style) {
      var selector;
      if (style.showPoints && style.showLines)
        selector = $('.linestyle-line-with-points');
      else if (style.showPoints)
        selector = $('.linestyle-scatter');
      else if (style.showLines)
        selector = $('.linestyle-line');
      if (selector) this.selected(selector);
    },

    selected: function (selector) {
      $(selector).css('background', 'black');
    },

    unselected: function(selector) {
      $(selector).css('background', 'white');
    }



  });
});
