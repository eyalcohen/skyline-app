/*
 * Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/dataset.html',
  'Spin'
], function ($, _, Row, template, Spin) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {

      // Set background color.
      this.$el.css({backgroundColor: this.model.color()});

      return Row.prototype.setup.call(this);
    },

    events: {

    },

    _remove: function () {
      clearInterval(this.timer);
      this.destroy();
    },

  });
});
