/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({

  // Library paths:
  paths: {
    jQuery: 'lib/jquery/jquery',
    Underscore: 'lib/underscore/underscore.src',
    UnderscoreString: 'lib/underscore/underscore.string.src',
    Backbone: 'lib/backbone/backbone',
    Modernizr: 'lib/modernizr/modernizr',
    mps: 'lib/minpubsub/minpubsub',
    Spin: 'lib/spin/spin',
    excanvas: 'lib/excanvas/excanvas',
    plugins: 'lib/jquery/plugins',
    flot_plugins: 'lib/jquery/flot.plugins'
  },

  // Dependency mapping:
  shim: {
    Underscore: {
      exports: '_'
    },
    UnderscoreString: {
      deps: ['Underscore']
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
    plugins: {
      deps: ['jQuery']
    },
    flot_plugins: {
      deps: ['jQuery', 'plugins']
    },
  }
});

// Application entry point:
require([
  'app',
  'UnderscoreString',
  'plugins',
  'excanvas'
], function (app) { app.init(); });
