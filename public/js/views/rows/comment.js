/*
 * Comment Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/comment.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'comment'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // Icon handling.
      this.icon = $('<i class="icon icon-bookmark">');
      this.model.on('change:xpos', _.bind(function () {
        if (!this.icon) return;
        this.icon.css({left: this.model.get('xpos') - 4});
      }, this));
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
    },

    render: function (single) {
      this.parentView.off('rendered');
      this.$el.html(this.template.call(this));
      if (!single || this.model.collection.length === 1)
        this.$el.insertAfter(this.parentView.$('.list-header'));
      else {
        var i; var c = _.find(this.model.collection.models,
            _.bind(function (m, _i) {
          i = _i;
          return m.get('time') < this.model.get('time');
        }, this));
        if (!c && i === this.model.collection.length - 1)
          this.$el.insertBefore(this.parentView.views[this.parentView.views.length - 2].$el);
        else
          this.$el.insertAfter(this.parentView.views[i + 1].$el);
      }
      this.$el.show();
      this.time = null;
      this.trigger('rendered');
      return this;
    },

    delete: function (e) {
      e.preventDefault();
      rest.delete('/api/comments/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        this.icon.remove();
        cb();
      }, this));
    },

  });
});
