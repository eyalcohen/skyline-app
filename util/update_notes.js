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

      db.Notes.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      _.each(docs, _.bind(function (d) {

        if (d.time)
          db.Notes._update({_id: d._id}, {
            $set: {beg: d.time, end: d.time},
            $unset: {time: 1}
          }, this.parallel());
      }, this));
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
