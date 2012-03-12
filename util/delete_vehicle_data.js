#!/usr/bin/env node

// Delete all samples of a given vehicle.

var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-samples')
    .demand('vehicleId')
    .describe('channelName', 'Channel name to delete')
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}


// Connect to DB.
mongodb.connect(argv.db, {
                  server: { poolSize: 4 },
                  db: { native_parser: false },
                }, function(err, db) {
errCheck(err, 'connect('+argv.db+')');
new SampleDb(db, { ensureIndexes: true }, function (err, sampleDb) {
errCheck(err, 'new sampleDb');

if (argv._.length)
  optimist.showHelp();

Step(
  function() {
    var parallel = this.parallel;
    _.values(sampleDb.realCollections).concat(
        _.values(sampleDb.syntheticCollections)).forEach(function (collection) {
      var query = { veh: argv.vehicleId };
      if (argv.channelName)
        query.chn = argv.channelName;
      collection.remove(query, { safe: true }, parallel());
    });
  }, function(err) {
    if (err)
      log('error: ' + err + '\n' + err.stack);
    process.exit(0);
  }
);

})});
