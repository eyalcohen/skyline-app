/*
 * Profile Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/profile.dataset.html',
  'Spin'
], function ($, _, Row, template, Spin) {
  return Row.extend({

    tagName: 'tr',

    attributes: function () {
      return _.defaults({class: 'profile-dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // When the id is set, we are done loading.
      this.model.on('change:id', _.bind(function () {
        
        // Stop the spinner.
        this.spin.stop();
      }, this));
    },

    setup: function () {

      // Init the load indicator.
      this.spin = new Spin(this.$('.profile-item-spin'));
      this.spin.target.hide();

      // Start the spinner.
      if (this.model.get('id') === -1)
        this.spin.start();

      return Row.prototype.setup.call(this);
    },

    events: {
      'click a.navigate': 'navigate',
    },

    navigate: function (e) {
      e.preventDefault();

      if (this.model.get('id') === -1) return false;
      store.set('state', {
        user_id: this.app.profile.user.id,
        datasets: [this.model.get('id')],
      });

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function () {
      clearInterval(this.timer);
      this.destroy();
    },

  });
});
