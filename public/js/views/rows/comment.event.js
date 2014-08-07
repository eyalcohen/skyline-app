/*
 * Comment event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/comment',
  'text!../../../templates/rows/comment.event.html',
  'views/rows/dataset.event',
  'views/rows/view.event',
  'views/rows/note.event'
], function ($, _, Backbone, mps, util, Model, template, Dataset, View, Note) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-wrap'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model);
      this.parentView = options.parentView;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.$el.html(this.template.call(this, {util: util}));
      this.parentView.$el.addClass('indent');
      this.$el.prependTo($('<div class="event-header">')
          .prependTo(this.parentView.$el));

      // Determine sub view type.
      var Target;
      var model = this.model.get('target');
      switch (this.model.get('parent_type')) {
        case 'dataset': Target = Dataset; break;
        case 'view': Target = View; break;
        case undefined: Target = Note; break;
      }

      // Render target as sub-view.  
      this.target = new Target({
        parentView: this.parentView,
        model: model
      }, this.app).render(true);

      this.trigger('rendered');
      return this;
    },

    setup: function () {

    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.target.destroy();
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
