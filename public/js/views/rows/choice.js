/*
 * Choice Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/choice.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'a',

    attributes: function () {
      var klass = 'choice';
      if (this.model.get('public') === false)
        klass += ' locked';
      return _.defaults({class: klass},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {

      // Add extra data.
      this.$el.attr({href: this.model.href()});
      this.$el.attr({'data-term': this.model.term()});

      return Row.prototype.render.call(this, single, prepend);
    },

    events: {
      'click': 'choose',
    },

    choose: function (e) {
      if (e) e.preventDefault();

      // Show selection.
      this.parentView.choose(this);

      // Go to page.
      if (!this.parentView.options.route) return;
      this.app.router.navigate(this.$el.attr('href'), {trigger: true});
    },

  });
});
