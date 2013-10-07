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

    attributes: function () {
      return _.defaults({class: 'channel'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
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
      console.log(this.model.attributes)
      if (e) e.preventDefault();
      if (this.button.hasClass('active')) {
        this.button.removeClass('active');
        mps.publish('channel/remove', [this.model.get('did'),
          this.model.get('val')]);
      } else {
        this.button.addClass('active');
        mps.publish('channel/add', [this.model.get('did'),
          this.model.get('val')]);
      }
      return false;
    },

    _remove: function () {
      clearInterval(this.timer);
      this.destroy();
    },

  });
});
