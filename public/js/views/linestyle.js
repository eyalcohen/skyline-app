/*
 * Small line style modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/linestyle.html',
], function ($, _, Backbone, mps, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'linestyle-modal',

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;
      this.channel = this.options.channel;
      this.currentLineStyle = this.channel.get('lineStyleOptions');

      // Shell events.
      this.on('rendered', this.setup, this);

      this.subscriptions = [];
    },

    // Draw the template
    render: function () {
      this.template = _.template(template, {channels: this.channels});
      this.$el.html(this.template).appendTo('body');
      var offset = this.options.parentView.$el.offset();
      this.$el.css('top', offset.top);
      this.$el.css('left', offset.left + this.options.parentView.$el.outerWidth());
      this.$el.show();
      this.trigger('rendered');
      return this;
    },

    // Bind events.
    events: {
      'mouseleave': 'mouseleave',
      'click .linestyle-box' : 'linetypeUpdate',
      'mouseenter .linestyle-box' : 'linetypeUpdate',
      'mouseleave .linestyle-box' : 'linetypeUpdate',
    },

    // Misc. setup.
    setup: function () {

      // messing around, make the hover color a light version of the parent
      // var parentBg = this.options.parentView.$el.css('background-color');
      var parentSel = this.options.parentView.$el;
      var modalBg = this.$el.css('background-color');
      $('.linestyle-box').hover(
        function() {
          if ($(this).css('background-color') === modalBg) {
            var parentBg = parentSel.css('background-color');
            $(this).css('background-color', util.lightenColor(parentBg, .5));
          }
        },
        function() {
          var parentBg = parentSel.css('background-color');
          if ($(this).css('background-color') !== parentBg) {
            $(this).css('background-color', modalBg);
          }
        }
      );

      this.setViewLineStyle();

      $('.linestyle-color').minicolors( {
        position: 'bottom left',
        change: _.bind(function(hex, opacity) { this.colorChange(hex); }, this),
        changeDelay: 10,
        defaultValue: util.rgbToHex(parentSel.css('background-color')),
      });


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
      this.remove();
      cb();
    },

    mouseleave: function (e) {
      var over = document.elementFromPoint(e.clientX, e.clientY);
      if ($(over).attr('id') !== this.options.parentView.model.id
          && $(over).parent().attr('id') !== this.options.parentView.model.id) {
        this.options.parentView.removeLineStyle(over);
      }
    },

    linetypeUpdate: function(e) {
      var target = e.target.classList[1];

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
        this.currentLineStyle.showArea = false;
        updatePoints = true;
      } else if (target === 'linestyle-line') {
        this.currentLineStyle.showPoints = false;
        this.currentLineStyle.showLines = true;
        this.currentLineStyle.showArea = false;
        updatePoints = true;
      } else if (target === 'linestyle-line-with-points') {
        this.currentLineStyle.showPoints = true;
        this.currentLineStyle.showLines = true;
        this.currentLineStyle.showArea = false;
        updatePoints = true;
      } else if (target === 'linestyle-area') {
        this.currentLineStyle.showPoints = false;
        this.currentLineStyle.showLines = true;
        this.currentLineStyle.showArea = true;
        updatePoints = true;
      } else if (target === 'linestyle-interp-linear') {
        this.currentLineStyle.interpolation = 'linear';
        updateInterp = true;
      } else if (target === 'linestyle-interp-none') {
        this.currentLineStyle.interpolation = 'none';
        updateInterp = true;
      } else if (target === 'linestyle-width-1') {
        this.currentLineStyle.lineWidth = 1;
        this.currentLineStyle.pointRadius = 2;
        updateWidth = true;
      } else if (target === 'linestyle-width-2') {
        this.currentLineStyle.lineWidth = 2;
        this.currentLineStyle.pointRadius = 3;
        updateWidth = true;
      } else if (target === 'linestyle-width-3') {
        this.currentLineStyle.lineWidth = 3;
        this.currentLineStyle.pointRadius = 4;
        updateWidth = true;
        updateWidth = true;
      } else if (target === 'linestyle-width-4') {
        this.currentLineStyle.lineWidth = 4;
        this.currentLineStyle.pointRadius = 5;
        updateWidth = true;
      }

      if (JSON.stringify(this.currentLineStyle) !== JSON.stringify(this.oldStyle)
          || e.type === 'click') {
        var save = e.type === 'click';
        mps.publish('channel/lineStyleUpdate',
            [this.channel.id, this.currentLineStyle, save]);
      }

      if (updatePoints && e.type === 'click') {
        this.unselect($('.linestyle-points').children())
        this.select('.' + target);
        this.oldStyle = null;
      }
      if (updateInterp && e.type === 'click') {
        this.unselect($('.linestyle-interp').children())
        this.select('.' + target);
        this.oldStyle = null;
      }
      if (updateWidth && e.type === 'click') {
        this.unselect($('.linestyle-width').children())
        this.select('.' + target);
        this.oldStyle = null;
      }

    },

    setViewLineStyle: function() {
      var style = this.currentLineStyle;
      var selector;
      if (style.showArea)
        selector = $('.linestyle-area');
      else if (style.showPoints && style.showLines)
        selector = $('.linestyle-line-with-points');
      else if (style.showPoints)
        selector = $('.linestyle-scatter');
      else if (style.showLines)
        selector = $('.linestyle-line');
      if (selector) this.select(selector);

      selector = {};
      if (style.interpolation === 'linear')
        selector = $('.linestyle-interp-linear');
      else
        selector = $('.linestyle-interp-none');
      if (selector) this.select(selector);

      selector = {};
      switch (style.lineWidth) {
        case 1:
          selector = $('.linestyle-width-1');
          break;
        default:
        case 2:
          selector = $('.linestyle-width-2');
          break;
        case 3:
          selector = $('.linestyle-width-3');
          break;
        case 4:
          selector = $('.linestyle-width-4');
          break;
      }
      if (selector) this.select(selector);
    },

    select: function (selector) {
      var parentBg = this.options.parentView.$el.css('background-color');
      $(selector).css('background-color', parentBg);
    },

    unselect: function(selector) {
      var modalBg = this.$el.css('background-color');
      $(selector).css('background-color', modalBg);
    },

    colorChange: function(hex) {
      this.currentLineStyle.color = hex;
      this.options.parentView.$el.css({
        backgroundColor: hex,
        borderColor: hex
      });
      this.setViewLineStyle();
      mps.publish('channel/lineStyleUpdate', [this.channel.id, this.currentLineStyle, true]);
    }

  });
});
