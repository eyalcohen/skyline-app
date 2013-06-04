/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({

  // Library paths:
  paths: {
    jQuery: 'libs/jquery/jquery',
    Underscore: 'libs/underscore/underscore',
    Backbone: 'libs/backbone/backbone',
    Modernizr: 'libs/modernizr/modernizr',
    mps: 'libs/minpubsub/minpubsub',
    Spin: 'libs/spin/spin',
    Delivery: 'libs/delivery/delivery'
  },

  // Dependency mapping:
  shim: {
    Underscore: {
      exports: '_'
    },
    Backbone: {
      deps: ['jQuery', 'Underscore'],
      exports: 'Backbone'
    },
    Modernizr: {
      exports: 'Modernizr'
    },
    mps: {
      deps: ['jQuery', 'Underscore'],
      exports: 'mps'
    },
    Spin: {
      exports: 'Spin'
    },
    Delivery: {
      exports: 'Delivery'
    },
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});
