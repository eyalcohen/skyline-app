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

      // When the id is set, we are done loading.
      this.model.on('change:id', _.bind(function () {
        
        // Stop the spinner.
        this.spin.stop();
      }, this));
    },

    setup: function () {

      // Init the load indicator.
      this.spin = new Spin(this.$('.dataset-spin'));
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

      // Route to wherever.
      var path = $(e.target).attr('href') || $(e.target).parent().attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});
