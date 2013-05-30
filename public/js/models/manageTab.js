/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      this.targetClass = args.targetClass;

      this.view = new App.views.ManageTabView(args);
      this.view.render({
        title: 'Manage',
        active: false,
        tabClosable: false,
        tabRight: 30,
        dynamic: false,
      }, 'manage.jade');

      this.finderModel = new App.models.FinderModel({
        title: 'Views',
        parent: '.manage .dashboard-left',
        height: 'full',
      });
      this.finderModel.fetch('users', false,
                             _.bind(function () {
        this.finderModel.view.select('users');
      }, this));

      // this.infoModel = new App.models.InfoModel({
      //   title: 'Preferences',
      //   parent: '.manage .dashboard-right',
      //   height: 'full',
      // });

      return this;
    },

    destroy: function () {},

  });
});

