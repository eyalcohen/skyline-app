#!/usr/bin/env node
/*
 * index.js: Index all datasets and views for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var profiles = require('../lib/resources').profiles;

boots.start(function (client) {

  // Create searches.
  var searches = {
    datasets: reds.createSearch('datasets'),
    views: reds.createSearch('views')
  };
  _.each(searches, function (s) { s.client = client.redisClient; });

  Step(
    function () {

      // Get all datasets.
      db.Datasets.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.datasets.remove(d._id, function (err) {
          boots.error(err);

          // Index dataset title.
          if (d.title && d.title !== '' && d.title.match(/\w+/g))
            searches.datasets.index(d.title, d._id, _this);
          else _this();
        });

      });
    },
    function (err) {
      boots.error(err);

      // Get all views.
      db.Views.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.views.remove(d._id, function (err) {
          boots.error(err);

          // Index view name.
          if (d.name && d.name !== '' && d.name.match(/\w+/g))
            searches.views.index(d.name, d._id, _this);
          else _this();
        });

      });
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
