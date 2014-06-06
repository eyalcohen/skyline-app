/*
 * Sidebar Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'util',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/dataset.sidebar.html'
], function ($, _, mps, util, rest, Row, template) {
  return Row.extend({

    tagName: 'li',

    attributes: function () {
      return _.defaults({class: 'sidebar-dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      _.extend(options, {templateData: {util: util}});
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {
      return Row.prototype.setup.call(this);
    },

    events: {
      'click .navigate': 'navigate'
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
