/*
 * Channel Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/channel.chart.html',
  'views/linestyle'
], function ($, _, mps, rest, Row, template, LineStyle) {
  return Row.extend({

    active: false,

    attributes: function () {
      return _.defaults({class: 'channel hide'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.options = options;
      this.template = _.template(template);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/added', _.bind(this.added, this)),
        mps.subscribe('channel/removed', _.bind(this.removed, this)),
      ];

      Row.prototype.initialize.call(this, options);
    },

    setup: function () {

      // Save refs.
      this.button = this.$('a.channel-button');
      this.name = this.$('.channel-name', this.button);
      this.txt = this.$('.channel-name .channel-name-text');
      this.value = this.$('.channel-value');

      // Bind click event.
      this.button.click(_.bind(this.toggle, this));
      this.$el.find('.channel-yaxis-code').click(_.bind(function(e) {
        if (!this.active)
          return;
        e.stopPropagation();
        var lso = this.model.get('lineStyleOptions');
        switch (this.model.get('lineStyleOptions').yaxis) {
          default:
          case 1:
            lso.yaxis = 2;
            this.model.set('lineStyleOptions', lso);
            break;
          case 2:
            lso.yaxis = 1;
            this.model.set('lineStyleOptions', lso);
            break;
        };
        this.updateYAxisView();
        mps.publish('channel/lineStyleUpdate',
            [this.model.get('channelName'), this.model.get('lineStyleOptions'), true]);
      }, this));

      // Check if active in state.
      var state = store.get('state');
      var d = state.datasets && state.datasets[this.model.get('did')];
      if (d && d.channels && d.channels[this.model.id]) {
        var c = d.channels[this.model.id];
        this.model.set('colorNum', c.colorNum);
        this.model.set('yaxisNum', c.yaxisNum);
        _.defer(_.bind(function () {
          mps.publish('channel/add', [this.model.get('did'), this.model.toJSON()]);
        }, this));
        this.active = true;
        this.updateYAxisView();
        this.$el.addClass('active').show();
      }

      // Initial fit.
      this.fit(this.$el.width());
      return Row.prototype.setup.call(this);
    },

    events: {
      'click .channel-settings': 'showLineStyle'
    },

    fit: function (w) {
      this.$el.width(w);
    },

    toggle: function (e) {
      if (e) e.preventDefault();
      if (this.$el.hasClass('active')) {
        this.$el.removeClass('active');
        mps.publish('channel/remove', [this.model.get('did'),
            this.model.toJSON()]);
        this.active = false;
        this.removeLineStyle();
      } else {
        this.$el.addClass('active');
        mps.publish('channel/add', [this.model.get('did'),
            this.model.toJSON()]);
        this.active = true;
        this.updateYAxisView();

        // Count as a "view".
        rest.put('/api/channels/' + this.model.get('_id') + '/inc', {});
      }
      return false;
    },

    expand: function (cb) {
      var animate = this.parentView.collection.length < 20;
      if (animate) {
        this.$el.slideDown('fast', cb);
      } else {
        this.$el.show();
        if (cb) cb();
      }
      this.$el.css({opacity: 1});

      var i = this.$el.index() - 1;
      var h = this.$el.outerHeight();
      if (this.lineStyleModal) {
        this.lineStyleModal.position(i*h, animate);
      }
    },

    collapse: function (cb) {
      var animate = this.parentView.collection.length < 20;
      if (!this.$el.hasClass('active')) {
        if (animate) {
          this.$el.slideUp('fast', cb);
        } else {
          this.$el.hide();
          if (cb) cb();
        }
        this.$el.css({opacity: 0});
      } else if (this.lineStyleModal) {
        var active = this.parentView.$('.channel.active');
        var i; _.find(active, _.bind(function (el, _i) {
          i = _i;
          return this.el === el;
        }, this));
        var h = this.$el.outerHeight();
        this.lineStyleModal.position(i*h, animate);
      }
    },

    added: function (did, channel, style) {
      if (this.model.get('did') !== did
          || this.model.id !== channel.channelName) return;
      this.model.set('lineStyleOptions', style);
      var color = style.color || this.app.getColors(channel.colorNum);

      // handles the case where we add the channel from outside the toggle function
      if (!this.$el.hasClass('active')) {
        this.$el.addClass('active');
        if (!this.parentView.active) {
          this.parentView.$('.channel.active').removeClass('last-active');
          this.parentView.$('.channel.active:last').addClass('last-active');
        }
        this.active = true;
        this.expand();
      }

      this.updateYAxisView();

      this.$el.css({
        backgroundColor: color,
        borderColor: color
      });
    },

    removed: function (did, channel) {
      if (this.model.get('did') !== did
          || this.model.id !== channel.channelName) return;
      if (this.$el.hasClass('active')) {
        this.$el.removeClass('active');
        this.active = false;
        this.removeLineStyle();
      }

      // Set colors.
      this.$el.css({
        backgroundColor: 'transparent',
        borderColor: '#d0d0d0'
      });
      this.$el.removeClassWithPrefix('yaxis-');
    },

    destroy: function () {
      Row.prototype.destroy.call(this);
      this.removeLineStyle();

      // Remove channel from graph.
      mps.publish('channel/remove', [this.model.get('did'),
          this.model.toJSON()]);
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    showLineStyle: function (e) {
      if (!this.$el.hasClass('active')) {
        return;
      }
      if (!this.lineStyleModal) {
        mps.publish('channel/requestLineStyle');
        this.lineStyleModal = new LineStyle(this.app,
            {parentView: this, channel: this.model}).render();
      } else {
        this.removeLineStyle();
      }
    },

    removeLineStyle: function () {
      if (this.lineStyleModal) {
        this.lineStyleModal.destroy(_.bind(function () {
          delete this.lineStyleModal;
        }, this));
      }
    },

    updateYAxisView: function () {
      if (!this.active) {
        return;
      }
      var lso = this.model.get('lineStyleOptions');
      var currentYAxis = lso.yaxis;
      if (!currentYAxis) return;
      this.$el.removeClass('yaxis-left').removeClass('yaxis-right');
      var icon = this.$('.channel-yaxis-code i');
      if (currentYAxis === 1) {
        this.$el.addClass('yaxis-left');
        icon.removeClass().addClass('icon-angle-left');
      } else if (currentYAxis === 2) {
        this.$el.addClass('yaxis-right');
        icon.removeClass().addClass('icon-angle-right');
      }
    },

  });
});
