/*
 * Profile View Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/profile.view.html'
], function ($, _, mps, rest, Row, template) {
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
      'click .profile-item-delete': 'delete',
    },

    navigate: function (e) {
      e.preventDefault();
      if ($(e.target).hasClass('profile-item-delete')
          || $(e.target).hasClass('icon-cancel')) return;

      // Set app state.
      var state = this.model.attributes;
      state.user_id = this.app.profile.user.id;
      store.set('state', state);
      
      // Route to a new chart.
      var key = [this.model.get('author').username, 'views',
          this.model.get('slug')].join('/');
      this.app.router.navigate('/' + key, {trigger: true});
    },

    delete: function (e) {
      e.preventDefault();
      rest.delete('/api/views/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
