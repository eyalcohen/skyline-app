#!/usr/bin/env node

// Transfer data from old DB format to new DB format.

var log = require('console').log;
var debug = require('util').debug;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util');
var _ = require('underscore');

var SampleDb = require('./sample_db.js').SampleDb;
var compatibility = require('./compatibility.js');

var argv = require('optimist')
    .default('srcDb', 'mongo://localhost:27017/service-development')
    .default('srcCollection', 'eventbuckets')
    .default('destDb', 'mongo://localhost:27017/service-samples')
    .boolean('ensureIndexes')
    .default('ensureIndexes', true)
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

// Connect to source DB, eventbuckets collection.
mongodb.connect(argv.srcDb, {
                  server: { poolSize: 4 },
                }, function(err, srcDb) {
errCheck(err, 'connect('+argv.srcDb+')');
srcDb.collection(argv.srcCollection, function(err, srcCollection) {
errCheck(err, 'srcDb.collection('+argv.srcCollection+')');

// Connect to dest DB, samples collection.
mongodb.connect(argv.destDb, {
                  server: { poolSize: 4 },
                }, function(err, destDb) {
errCheck(err, 'connect('+argv.destDb+')');
new SampleDb(destDb, { ensureIndexes: argv.ensureIndexes },
             function (err, sampleDb) {
errCheck(err, 'new sampleDb');

srcDb.on('close', function() { debug('srcDb closed!'); });
destDb.on('close', function() { debug('destDb closed!'); });
function printBufferSize() {
  try {
    var total = 0;
    destDb.serverConfig.connection.pool.forEach(function(p) {
      total += p.connection.bufferSize;
    });
    if (total > 0)
      debug('destDb bufferSize == ' + total);
  } catch (err) {
    debug('Error:\n' + err.stack);
  }
}

// Query for all drive cycles.
log('Opened DBs, querying for drive cycles...');
srcCursor = srcCollection.find({}, [], { sort: ['_id'] } );
processDoc();
function processDoc() {
srcCursor.nextObject(function(err, doc) {
errCheck(err, 'srcCursor.nextObject');

if (!doc) {
  done();
  return;
}

// Process a drive cycle.
compatibility.insertEventsProto(sampleDb, doc, {}, function(err) {
  if (err) {
    debug('Error processing event:\n' + err.stack);
    process.exit(1);
  }
  // On to next drive cycle.
  process.nextTick(processDoc);
});

})}

function done() {
  Step(
    function() {
      printBufferSize();
      log('Closing DBs.');
      srcDb.serverConfig.close(this.parallel());
      destDb.serverConfig.close(this.parallel());
      log('DBs closed.');
    }, function(err) {
      log('All done!  ' + err);
      // Flush stdout.
      process.stdout.once('close', function() {
        process.exit(0);
      });
      process.stdout.destroySoon();
    }
  );
}

})})})});

// JS parser: 113.05s
// native parser: 17.32s
// Wow!

// Statistics for storing data in different forms:

/* Bucketed (no synthetic buckets yet), with ids:
cyclers:PRIMARY> db.samples.stats()
{
        "ns" : "service-samples.samples",
        "count" : 7739,
        "size" : 191630668,
        "avgObjSize" : 24761.683421630703,
        "storageSize" : 238023680,
        "numExtents" : 16,
        "nindexes" : 2,
        "lastExtentSize" : 44309760,
        "paddingFactor" : 1.009999999999949,
        "flags" : 1,
        "totalIndexSize" : 1138688,
        "indexSizes" : {
                "_id_" : 327680,
                "veh_1_syn_1_lev_1_buck_1" : 811008
        },
        "ok" : 1
}
*/

// old, pure: ./pitchfork.js --writeType=bucket  505.07s user 10.59s system 70% cpu 12:07.39 total
// "count" : 7770,
// "size" : 185586348,
// "avgObjSize" : 23884.986872586873,

// old, native: ./pitchfork.js --writeType=bucket  490.24s user 8.19s system 80% cpu 10:22.57 total
// "count" : 7770,
// "size" : 186580448,
// "avgObjSize" : 24012.92767052767,

// new, pure: ./pitchfork.js --writeType=bucket  68.49s user 2.27s system 58% cpu 2:00.63 total
// "count" : 7770,
// "size" : 186246744,
// "avgObjSize" : 23969.979922779923,

// new, native: ./pitchfork.js --writeType=bucket  72.26s user 2.40s system 61% cpu 2:01.01 total
// "count" : 7770,
// "size" : 186160220,
// "avgObjSize" : 23958.84427284427,

// Fixed huge writes!

// pure: ./pitchfork.js --writeType=bucket  4.33s user 0.90s system 46% cpu 11.323 total
// "count" : 7488,
// "size" : 4124840,  4MB
// "avgObjSize" : 550.8600427350427,

// pure: ./pitchfork.js --writeType=noBucket  27.53s user 3.78s system 58% cpu 53.876 total
// "count" : 98056,
// "size" : 11068088,  11MB
// "avgObjSize" : 112.875173370319,

// With safe, 1 destDb pool: ./pitchfork.js --writeType=noBucket  25.86s user 3.82s system 54% cpu 54.579 total
// Without safe, 1 destDb pool: ./pitchfork.js --writeType=noBucket  18.75s user 1.92s system 43% cpu 47.039 total
// Without safe, 4 destDb pool: ./pitchfork.js --writeType=noBucket  17.18s user 2.43s system 42% cpu 45.791 total
// Without poolr, 4 destDb pool: ./pitchfork.js --writeType=noBucket  12.61s user 1.81s system 50% cpu 28.450 total
