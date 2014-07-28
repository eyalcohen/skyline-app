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

    className: 'linestyle-modal',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.parentView = options.parentView;
      this.channel = this.options.channel;
      this.currentLineStyle = this.channel.get('lineStyleOptions');
      this.on('rendered', this.setup, this);
      this.subscriptions = [];
    },

    render: function () {
      this.template = _.template(template, {channels: this.channels});
      this.$el.html(this.template).appendTo('body');
      var offset = this.parentView.$el.offset();
      this.$el.css('top', offset.top);
      this.$el.css('left', offset.left + this.parentView.$el.outerWidth());
      this.$el.show();
      this.trigger('rendered');
      return this;
    },

    events: {
      'click .linestyle-close': 'close',
      'click .linestyle-box' : 'linetypeUpdate',
      'mouseenter .linestyle-box' : 'linetypeUpdate',
      'mouseleave .linestyle-box' : 'linetypeUpdate',
    },

    setup: function () {

      // messing around, make the hover color a light version of the parent
      // var parentBg = this.parentView.$el.css('background-color');
      var parentSel = this.parentView.$el;
      var modalBg = this.$el.css('background-color');
      $('.linestyle-box').hover(
        function() {
          if ($(this).css('background-color') === modalBg) {
            var parentBg = parentSel.css('background-color');
            $(this).css('background-color', util.lightenColor(parentBg, 0.5));
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

      // For rendering tooltips
      this.$('.tooltip').tooltipster({delay: 600, multiple: true});

      // Handle color choosing.
      $('.linestyle-color').minicolors( {
        position: 'bottom left',
        change: _.bind(function(hex, opacity) { this.colorChange(hex); }, this),
        changeDelay: 10,
        defaultValue: util.rgbToHex(parentSel.css('background-color')),
      });

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function (cb) {
      this.undelegateEvents();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.stopListening();
      this.remove();
      cb();
    },

    close: function (e) {
      e.preventDefault();
      this.parentView.removeLineStyle();
    },

    position: function (y, animate) {
      var offset = this.parentView.parentView.$el.parent().offset();
      this.$el.animate({top: y + offset.top - 1}, animate ? 200: 0);
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
        if (save) this.setViewLineStyle();
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
      var parentBg = this.parentView.$el.css('background-color');
      $(selector).css('background-color', parentBg);
    },

    unselect: function(selector) {
      var modalBg = this.$el.css('background-color');
      $(selector).css('background-color', modalBg);
    },

    colorChange: function(hex) {
      this.currentLineStyle.color = hex;
      this.parentView.$el.css({
        backgroundColor: hex,
        borderColor: hex
      });
      this.setViewLineStyle();
      mps.publish('channel/lineStyleUpdate', [this.channel.id, this.currentLineStyle, true]);
    }

  });
});
