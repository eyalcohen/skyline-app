/*
 * Channel Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/channel.html',
  'Spin'
], function ($, _, mps, Row, template, Spin) {
  return Row.extend({

    active: false,

    attributes: function () {
      return _.defaults({class: 'channel hide'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
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

      // Bind click event.
      this.button.click(_.bind(this.toggle, this));

      return Row.prototype.setup.call(this);
    },

    events: {

    },

    toggle: function (e) {
      if (e) e.preventDefault();
      if (this.$el.hasClass('active')) {
        this.$el.removeClass('active');
        mps.publish('channel/remove', [this.model.get('did'),
          this.model.get('val')]);
        this.active = false;
      } else {
        this.$el.addClass('active');
        mps.publish('channel/add', [this.model.get('did'),
          this.model.get('val')]);
        this.active = true;
      }
      return false;
    },

    expand: function () {
      if (!this.$el.hasClass('active'))
        this.$el.slideDown('fast');
    },

    collapse: function () {
      if (!this.$el.hasClass('active'))
        this.$el.slideUp('fast');
    },

    added: function (channel) {
      if (this.model.id !== channel.channelName) return;

      // Set colors.
      var color = this.app.colors[channel.colorNum % this.app.colors.length];
      this.$el.css({
        backgroundColor: color,
        borderColor: color
      });
      this.$el.addClass('active');
    },

    removed: function (channel) {
      if (this.model.id !== channel.channelName) return;

      // Set colors.
      this.$el.css({
        backgroundColor: 'transparent',
        borderColor: '#d0d0d0'
      });
      this.$el.removeClass('active');
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
