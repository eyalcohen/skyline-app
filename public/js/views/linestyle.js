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
    className: 'linestyle-modal',

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;
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
      this.$el.html(this.template).appendTo(this.options.parentView.$el);
      this.$el.show('fast');
      this.trigger('rendered');
      return this;
    },

    // Bind events.
    events: {
      'click .linestyle-box' : 'linetypeUpdate',
      'mouseenter .linestyle-box' : 'linetypeUpdate',
      'mouseleave .linestyle-box' : 'linetypeUpdate',
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
      var target = e.target.id;

      var updatePoints = false;
      var updateInterp = false;
      var updateWidth = false;

      if (e.type === 'mouseenter' || e.type === 'click') {
        this.oldStyle = {};
        _.extend(this.oldStyle, this.currentLineStyle);
      } else if (e.type === 'mouseleave') {
        if (this.oldStyle) {
          // check if we actually need to do anything
          if (JSON.stringify(this.currentLineStyle) === JSON.stringify(this.oldStyle)) {
            return;
          }
          // restore old style
          this.currentLineStyle = {}
          _.extend(this.currentLineStyle, this.oldStyle);
          this.oldStyle = null;
          target = null; // we don't care which box we left
          updatePoints = true; updateInterp = true;
        } else {
          return;
        }
      }

      if (target === 'linestyle-scatter') {
        this.currentLineStyle.showPoints = true;
        this.currentLineStyle.showLines = false;
        updatePoints = true;
      } else if (target === 'linestyle-line') {
        this.currentLineStyle.showPoints = false;
        this.currentLineStyle.showLines = true;
        updatePoints = true;
      } else if (target === 'linestyle-line-with-points') {
        this.currentLineStyle.showPoints = true;
        this.currentLineStyle.showLines = true;
        updatePoints = true;
      } else if (target === 'linestyle-interp-linear') {
        this.currentLineStyle.interpolation = 'linear';
        updateInterp = true;
      } else if (target === 'linestyle-interp-none') {
        this.currentLineStyle.interpolation = 'none';
        updateInterp = true;
      } else if (target === 'linestyle-width-1') {
        this.currentLineStyle.lineWidth = 1;
        updateWidth = true;
      } else if (target === 'linestyle-width-2') {
        this.currentLineStyle.lineWidth = 2;
        updateWidth = true;
      } else if (target === 'linestyle-width-3') {
        this.currentLineStyle.lineWidth = 3;
        updateWidth = true;
      } else if (target === 'linestyle-width-4') {
        this.currentLineStyle.lineWidth = 4;
        updateWidth = true;
      }

      if (JSON.stringify(this.currentLineStyle) !== JSON.stringify(this.oldStyle)) {
        mps.publish('channel/lineStyleUpdate', [this.channel.id, this.currentLineStyle]);
      }

      if (updatePoints && e.type === 'click') {
        this.unselected($('.linestyle-points').children())
        this.selected('#' + target);
        this.oldStyle = null;
      }
      if (updateInterp && e.type === 'click') {
        this.unselected($('.linestyle-interp').children())
        this.selected('#' + target);
        this.oldStyle = null;
      }
      if (updateWidth && e.type === 'click') {
        this.unselected($('.linestyle-width').children())
        this.selected('#' + target);
        this.oldStyle = null;
      }

    },

    responseLineStyle: function(style) {
      var selector;
      this.currentLineStyle = style;
      if (style.showPoints && style.showLines)
        selector = $('#linestyle-line-with-points');
      else if (style.showPoints)
        selector = $('#linestyle-scatter');
      else if (style.showLines)
        selector = $('#linestyle-line');
      if (selector) this.selected(selector);
      
      selector = {};
      if (style.interpolation === 'linear')
        selector = $('#linestyle-interp-linear');
      else
        selector = $('#linestyle-interp-none');
      if (selector) this.selected(selector);

      selector = {};
      switch (style.lineWidth) {
        case 1:
          selector = $('#linestyle-width-1');
          break;
        default:
        case 2:
          selector = $('#linestyle-width-2');
          break;
        case 3:
          selector = $('#linestyle-width-3');
          break;
        case 4:
          selector = $('#linestyle-width-4');
          break;
      }
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
