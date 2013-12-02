/*
 * Home Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/home.dataset.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    tagName: 'li',

    attributes: function () {
      return _.defaults({class: 'home-dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {
      return Row.prototype.setup.call(this);
    },

    events: {
      'click a': 'navigate'
    },

    navigate: function (e) {
      e.preventDefault();

      // Set app state.
      var state = {};
      if (this.app.profile && this.app.profile.user)
        state.user_id = this.app.profile.user.id;
      state.datasets = {};
      state.datasets[this.model.get('id')] = {index: 0};
      store.set('state', state);

      // Route to a new chart.
      this.app.router.navigate('/chart', {trigger: true});
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
