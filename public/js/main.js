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
    Modernizr: 'lib/modernizr/modernizr.src',
    mps: 'lib/minpubsub/minpubsub',
    Spin: 'lib/spin/spin',
    excanvas: 'lib/excanvas/excanvas.src',
    plugins: 'lib/jquery/plugins',
    flot_plugins: 'lib/jquery/flot.plugins',
    d3: 'lib/d3/d3.v3',
    Rickshaw: 'lib/rickshaw/rickshaw.min',
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
    Rickshaw: {
      deps: ['d3'],
      exports: 'Rickshaw'
    },
  }
});

// Application entry point:
require([
  'app',
  'UnderscoreString',
  'plugins',
  'excanvas'
], function (app) {
  window.__s = window.__s || '';
  app.init();
});
