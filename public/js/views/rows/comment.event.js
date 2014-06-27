/*
 * Comment Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/comment.event.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'event-comment'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
    },

    render: function (single, prepend, re) {
      Row.prototype.render.apply(this, arguments);

      // Highlight comment if indicated in URL
      if (this.model.id === this.app.requestedCommentId) {
        this.$el.addClass('highlight-' + this.model.get('parent_type'));
        _.delay(_.bind(function () {
          this.$el.removeClass('highlight-' + this.model.get('parent_type'));
        }, this), 1000);
        _.delay(_.bind(function () {
          $.scrollTo(this.$el, 1000, {easing:'easeOutExpo'});
        }, this), 100);
      }

      return this;
    },

    setup: function () {
      return Row.prototype.setup.call(this);
    },

    delete: function (e) {
      e.stopPropagation();
      e.preventDefault();
      rest.delete('/api/comments/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.stopPropagation();
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

  });
});
