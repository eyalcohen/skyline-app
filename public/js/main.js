/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({

  // Library paths:
  paths: {
    jQuery: 'lib/jquery/jquery',
    Underscore: 'lib/underscore/underscore',
    Backbone: 'lib/backbone/backbone',
    Modernizr: 'lib/modernizr/modernizr',
    mps: 'lib/minpubsub/minpubsub',
    Spin: 'lib/spin/spin'
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
    }
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});
