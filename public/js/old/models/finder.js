/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });
      this.tabModel = args.tabModel;
      this.view = new App.views.FinderView(args);
      this.view.render({ loading: true });
      _.bindAll(this, 'destroy');
      return this;
    },

    destroy: function () {
      var tabId = this.get('tabId');
    },

    fetch: function (type, showLoading, cb) {
      var self = this;
      if (showLoading)
        self.view.render({ loading: showLoading });
      App.api.fetchFinderTree(type, function (err, data) {
        if (err) { throw err; return; }
        if (!data || data.length === 0) {
          self.view.renderTree({ empty: true });
          return;
        }
        self.data = data;
        self.view.renderTree();
        if (cb) cb();
      });

      return self;
    },

  });
});

