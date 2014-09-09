#!/usr/bin/env node
/*
 * update_streams.js: take the streaming props from producer
 * and put them on the actual dataset.
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
      db.Datasets.list({producer_id: {$exists: 1}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        db.Producers.read({_id: d.producer_id}, function (err, pro) {
          boots.error(err);
          if (!pro) {
            return _this();
          }
          db.Datasets._update({_id: d._id}, {$set: {
            uri: pro.uri,
            transform: pro.transform,
            schedule: pro.schedule,
            type: 'json',
            streaming: false
          }, $unset: {producer_id: 1}}, _this);
        });
      });
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
 
});
