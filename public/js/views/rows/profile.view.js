/*
 * Profile View Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/profile.view.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'tr',

    attributes: function () {
      return _.defaults({class: 'profile-view'},
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
      'click': 'navigate',
    },

    navigate: function (e) {
      e.preventDefault();

      // Set app state.
      var state = this.model.attributes;
      state.user_id = this.app.profile.user.id;
      store.set('state', state);
      
      // Route to a new chart.
      this.app.router.navigate('/chart', {trigger: true});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
