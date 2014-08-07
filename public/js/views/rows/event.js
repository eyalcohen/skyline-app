/*
 * Event Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/event.html',
  'views/rows/dataset.event',
  'views/rows/view.event',
  'views/rows/comment.event',
  'views/rows/note.event'
], function ($, _, Row, mps, rest, template, Dataset, View, Comment, Note) {
  return Row.extend({

    attributes: function () {
      var klass = 'event';
      if (this.model.get('public') === false) {
        klass += ' locked';
      }
      return _.defaults({class: klass},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);

      // Determine sub view type.
      var Action;
      switch (this.model.get('action_type')) {
        case 'dataset': Action = Dataset; break;
        case 'view': Action = View; break;
        case 'comment': Action = Comment; break;
        case 'note': Action = Note; break;
      }

      // Render action as sub-view.
      if (Action) {
        var model = this.model.get('action');
        model.target = this.model.get('target');
        model.event = this.model.get('data');
        this.action = new Action({
          parentView: this,
          model: model
        }, this.app).render(true);
      }

      return this;
    },

    destroy: function () {
      this.action.destroy();
      Row.prototype.destroy.call(this);
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
