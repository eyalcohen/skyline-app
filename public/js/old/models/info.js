/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.tabModel = args.tabModel;
      this.view = new App.views.InfoView(args);
      this.view.render({ loading: true });
      _.bindAll(this, 'destroy');
      
      return this;
    },

    destroy: function () {
      var tabId = this.get('tabId');
    },

  });
});

