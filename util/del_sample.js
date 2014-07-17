#!/usr/bin/env node
/*
 * del_sample.js - delete all samples before a specific date
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('query', 'Dataset query')
    .describe('param', 'Dataset query')
    .describe('date', 'Delete samples before this date')
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
var com = require('../lib/common');
var samples = require('../lib/samples');

var date = new Date(argv.date);
var did = Number(argv.did);
if (!com.isValidDate(date)) {
  optimist.showHelp();
  process.exit(1);
}

console.log('Deleting samples on datasets');
console.log({query: argv.query, param: argv.param, date: date});

// For every real collection
// Locate all samples that fit dataset id
// Take all samples, and for each, check that the first array element is 

boots.start(function (client) {

  Step(
    function () {
      var query = {};
      var match = argv.param.match(/ObjectId\("([A-Za-z0-9]*)/);
      if (match) {
        argv.param = db.oid(match[1]);
      }
      query[argv.query] = argv.param;
      db.Datasets.list(query, this);
    },
    function (err, docs) {
      if (err || !docs || docs.length === 0) return this(err);
      _.each(_.pluck(docs, '_id'), _.bind(function(did) {

        // Delete real collections before date
        _.each(client.samples.realCollections, _.bind(function (col) {
          col.remove({did: did, end: {$lte: date.valueOf()*1000}}, this.parallel());
        }, this));

        // Delete synthetic collections before date.  This work partially, since
        // it doesn't delete dates between database 'buckets'
        _.each(client.samples.syntheticCollections, _.bind(function (col) {
          // 50 is syntheticSamplesPerRow, which isn't exported.  Note that
          // these aren database buckets, which are actual buckets * 50
          var buk = Math.floor(date.valueOf() * 1000 / col.collectionName.split('_')[1] / 50);
          col.remove({did: did, buk: {$lte: Number(buk)-1}}, this.parallel());
        }, this));

        // Update channel start date
        db.Channels.update({parent_id: did},
            {$max: {beg: date.valueOf() * 1000}}, {multi: true}, this.parallel());

      }, this));
    },
    function (err, docs) {
      boots.error(err);
      console.log('Done');
      process.exit(0);
    }
  );

});
