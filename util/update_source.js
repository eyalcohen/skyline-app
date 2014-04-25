#!/usr/bin/env node
/*
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
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');

boots.start(function (client) {

  Step(
    function () {

      db.Datasets.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        var tags = d.tags;
        if (tags === '') tags = [];
        var sources = d.source ? [d.source]: d.sources || [];
        if (sources && sources[0] === '') sources = [];
        db.Datasets._update({_id: d._id}, {
          $set: {sources: sources, tags: tags},
          $unset: {source: 1}
        }, _this);
      });
    },
    function (err) {
      boots.error(err);

      db.Views.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        var tags = d.tags;
        if (tags === '') tags = [];
        var sources = d.source ? [d.source]: d.sources || [];
        if (sources && sources[0] === '') sources = [];
        db.Views._update({_id: d._id}, {
          $set: {sources: sources, tags: tags},
          $unset: {source: 1}
        }, _this);
      });
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
