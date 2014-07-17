#!/usr/bin/env node
/*
 * del_sample.js - delete all samples before a specific date
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('did', 'Dataset ID')
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

console.log(argv.did, date);

// For every real collection
// Locate all samples that fit dataset id
// Take all samples, and for each, check that the first array element is 

boots.start(function (client) {

  Step(
    function () {
      //console.log(client.samples);
      _.each(client.samples.realCollections, _.bind(function (col) {
        col.remove({did: did, end: {$lte: date.valueOf()*1000}}, this.parallel());
      }, this));
      _.each(client.samples.syntheticCollections, _.bind(function (col) {
        // 500 is syntheticSamplesPerRow * 10.
        var buk = Math.floor(date.valueOf() * 1000 / col.collectionName.split('_')[1] / 50);
        col.remove({did: did, buk: {$lte: Number(buk)-1}}, this.parallel());
      }, this));
      db.Channels.update({parent_id: did},
          {$max: {beg: date.valueOf() * 1000}}, {multi: true}, this);
    },
    function (err, docs) {
      boots.error(err);
      process.exit(0);
    }
  );

});
