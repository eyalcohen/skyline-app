/*
 * Event Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/event.html'
], function ($, _, Row, mps, rest, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'event'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click .event-link': 'link', 
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    link: function (e) {
      e.preventDefault();
      var did = Number(this.model.get('data').target.i);
      if (!did) return;

      // Set app state.
      var state = {};
      if (this.app.profile && this.app.profile.user)
        state.user_id = this.app.profile.user.id;
      state.datasets = {};
      state.datasets[did] = {index: 0};
      store.set('state', state);

      // Route to a new chart.
      this.app.router.navigate('/chart', {trigger: true});
    }

  });
});
