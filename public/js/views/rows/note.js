/*
 * Note Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/note.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'note'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // Type handling.
      if (this.model.get('parent_type') === 'view')
        this.$el.addClass('note-view');
      else if (this.model.get('parent_type') === 'dataset')
        if (this.model.get('leader'))
          this.$el.addClass('note-dataset-leader');
        else
          this.$el.addClass('note-dataset');

      // Set position.
      this.model.on('change:xpos', _.bind(function () {
        this.$el.css({
          left: this.model.get('xpos'),
          opacity: this.model.get('opacity')
        }).width(this.model.get('width'));
      }, this));
    },

    events: {
      'click': 'open',
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
      'mouseover': 'over',
      'mousemove': 'pass',
      'mousedown': 'pass',
      'mouseup': 'pass',
      'mousewheel': 'pass',
      'mouseout': 'out'
    },

    setup: function () {
      Row.prototype.setup.call(this);

      return this;
    },

    delete: function (e) {
      e.preventDefault();
      rest.delete('/api/notes/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.preventDefault();
      if ($(e.target).hasClass('info-delete')) return;
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

    open: function (e) {
      var avg = Math.round(((this.model.get('beg') + this.model.get('end')) / 2));
      // mps.publish('chart/zoom', [{center: avg}]);

      this.parentView.open(this);
    },

    over: function (e) {
      e.preventDefault();
      
    },

    pass: function (e) {
      if (this.parentView.parentView.graph.$el.css('pointer-events') === 'none')
        return;
      this.parentView.parentView.graph.$el.trigger(e);
    },

    out: function (e) {

    }

  });
});
