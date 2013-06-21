/*!
 * Copyright 2011 Mission Motors
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'views/home',
  'views/graph'
], function ($, _, Backbone, mps, util, Home, Graph) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function(app) {

      // Save app reference.
      this.app = app;

      // Page routes:
      this.route(':username/:did', 'graph', this.graph);
      this.route('', 'home', this.home);
    },

    routes: {
      // Catch all:
      '*actions': 'default'
    },

    home: function () {
      if (this.page)
        this.page.destroy();
      this.page = new Home(this.app).render();
    },

    graph: function (username, did) {
      if (this.page)
        this.page.destroy();

      this.page = new Graph(this.app, {
        vehicleId: _.str.strLeft(did, '?'),
        visibleTime: {
          beg: util.getParameterByName('b'),
          end: util.getParameterByName('e')
        }
      }).render();
    }

  });

  return Router;
});
