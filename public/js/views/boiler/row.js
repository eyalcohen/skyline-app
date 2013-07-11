/*
 * List Row view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util'
], function ($, _, Backbone, mps, util) {
  return Backbone.View.extend({

    tagName: 'div',

    attributes: function () {
      return {
        id: this.model ? this.model.id: '',
      };
    },

    initialize: function (options) {
      this.parentView = options.parentView;
      this.on('rendered', this.setup, this);
      if (this.parentView)
        this.parentView.on('rendered', _.bind(function () {
          this.setElement(this.parentView.$('#' + this.model.id));
          this.render();
        }, this));
      else
        this.wrap = $(this.options.wrap);

      if (this.model)
        this.model.on('change:id', _.bind(this.render, this, true, true, true));

      return this;
    },

    render: function (single, prepend, re) {
      this.$el.html(this.template.call(this));
      if (this.model.collection) {
        var d = this.model.collection.indexOf(this.model) * 0;
        _.delay(_.bind(function () {
          this.$el.show();
        }, this), single ? 0 : d);
      } else this.$el.show();
      if (single && !re)
        if (prepend) {
          if (this.parentView.$('.list-header').length !== 0)
            this.$el.insertAfter(this.parentView.$('.list-header'));
          else
            this.$el.prependTo(this.parentView.$el);
        } else {
          if (this.parentView)
            this.$el.appendTo(this.parentView.$el);
          else
            this.$el.appendTo(this.wrap);
        }
      this.time = null;
      this.trigger('rendered');
      return this;
    },

    setup: function () {
      if (!this.model.get('updated'))
        this.model.created = Date.now();
      this.$('.currency').each(function () {
        var str = util.addCommas($(this).text());
        $(this).text('$' + str.trim());
      });
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
      return this;
    },

    // Kill this view.
    destroy: function () {
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    toHTML: function () {
      return this.$el.clone().wrap('<div>').parent().html();
    },

    when: function () {
      if (!this.model) return;
      if (!this.time)
        this.time = this.$('time.created:first');
      this.time.text(util.getRelativeTime(this.model.get('updated')));
    },

  });
});