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
    html2canvas: 'lib/html2canvas/html2canvas',
    excanvas: 'lib/excanvas/excanvas.src',
    plugins: 'lib/jquery/plugins',
    flot_plugins: 'lib/jquery/flot.plugins',
    d3: 'lib/d3/d3.v3'
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
    html2canvas: {
      exports: 'html2canvas'
    },
    plugins: {
      deps: ['jQuery']
    },
    flot_plugins: {
      deps: ['jQuery', 'plugins']
    },
    d3: {
      exports: 'd3',
    }
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
