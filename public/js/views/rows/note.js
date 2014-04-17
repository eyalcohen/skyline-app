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

      // // Icon handling.
      // this.icon = $('<i class="icon icon-bookmark">');
      // if (this.model.get('parent_type') === 'view')
      //   this.icon.addClass('icon-code-view');
      // else if (this.model.get('parent_type') === 'dataset')
      //   if (this.model.get('leader'))
      //     this.icon.addClass('icon-code-dataset-leader');
      //   else
      //     this.icon.addClass('icon-code-dataset');
      // this.model.on('change:xpos', _.bind(function () {
      //   if (!this.icon) return;
      //   this.icon.css({left: this.model.get('xpos') - 8});
      // }, this));
    },

    events: {
      'click': 'open',
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
      'mouseover': 'highlight',
      'mouseout': 'unhighlight',
    },

    render: function (single, prepend, re) {
      console.log(this)
      // if (re) return;
      // this.parentView.off('rendered');
      // this.$el.html(this.template.call(this));
      // if (!single || this.model.collection.length === 1)
      //   this.$el.insertAfter(this.parentView.$('.list-header'));
      // else {
      //   var i; var v = _.find(this.parentView.views, _.bind(function (_v, _i) {
      //     i = _i;
      //     return _v.model.get('time') < this.model.get('time');
      //   }, this));
      //   if (!v && i === this.parentView.views.length - 1)
      //     this.$el.insertBefore(this.parentView.views[this.parentView.views.length - 1].$el);
      //   else
      //     this.$el.insertAfter(this.parentView.views[i + 0].$el);
      // }
      // this.$el.show();
      // this.time = null;
      this.trigger('rendered');
      return this;
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

    destroy: function () {
      this.icon.remove();
      Row.prototype.destroy.call(this);
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
      this.icon.addClass('hover');
    },

    unhighlight: function (e) {
      this.icon.removeClass('hover');
    }

  });
});
