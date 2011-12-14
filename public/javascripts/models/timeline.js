/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      this.view = new App.views.TimelineView(args);
      this.view.render({
        title: args.title,
        loading: true,
      });

      return this;
    },

    destroy: function () {
      this.view.destroy();
    },

  });
});

