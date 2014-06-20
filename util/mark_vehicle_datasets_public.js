#!/usr/bin/env node
/*
 * wipe_db.js: Remove docs from all collectoins.
 * This is useful for clearing DB without having to re-index.
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
        if (d.public !== 'false') return _this();
        db.Datasets._update({_id: d._id}, {$set: {public: true}}, _this);
      });
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
 
});
