/*!
 * Copyright 2011 Mission Motors
 */

define(['models/user'], function (model) {
  return Backbone.Collection.extend({
    model: model,
    readFunc: 'fetchUsers',

    initialize: function () {
      this.view = new App.views.UsersView({ collection: this });
      this.view.render({ loading: true });
      this.loaded = _.bind(function () {
        var rows = [];
        _.each(this.models, function (m) {
          rows.push({
            email: m.attributes.primaryEmail,
            first: m.attributes.displayName,
            // htmlId: m.attributes.htmlId,
          });
        });
        this.view.render({rows: rows});
      }, this);
      return this;
    },

  });
});

