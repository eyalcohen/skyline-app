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
      'mouseover': 'highlight',
      'mouseout': 'unhighlight',
    },

    setup: function () {
      Row.prototype.setup.call(this);

      // Icon events.
      // this.icon.bind('mouseover', _.bind(function (e) {
      //   this.icon.addClass('hover');
      //   this.$el.addClass('hover');
      // }, this));
      // this.icon.bind('mouseout', _.bind(function (e) {
      //   this.icon.removeClass('hover');
      //   this.$el.removeClass('hover');
      // }, this));
      // this.icon.click(_.bind(function (e) {
      //   // this.discussion = new Discussion(this.app, {model: this.model}).render();
      // }, this));

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
      if ($(e.target).hasClass('info-delete')
          || $(e.target).hasClass('navigate')
          || $(e.target).parent().hasClass('navigate')) return;
      this.discussion = new Discussion(this.app, {model: this.model}).render();
      mps.publish('chart/zoom', [{center: this.model.get('time')}]);
    },

    highlight: function (e) {
      // this.icon.addClass('hover');
    },

    unhighlight: function (e) {
      // this.icon.removeClass('hover');
    }

  });
});
