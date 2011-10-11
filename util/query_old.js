#!/usr/bin/env node

// Query old-style eventbuckets and write json.

var vm = require('vm');
var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-production')
    .demand('vehicleId')  // 4-byte hex id - first 4 bytes of vehicle _id
      .default('vehicleId', 'ff90182d')  // Gen3
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

function cursorIterate (cursor, rowCb, doneCb) {
  var stream = cursor.streamRecords();
  stream.on('data', rowCb);
  stream.on('end', function() { doneCb(null); });
  stream.on('error', doneCb);
}

function indent(prefix, str) { return str.replace(/^/mg, prefix); }
function insp(obj) { return inspect(obj, false, null); }


// Connect to DB.
mongodb.connect(argv.db, function(err, db) {
errCheck(err, 'connect('+argv.db+')');
db.collection('eventbuckets', function(err, eventbuckets) {
errCheck(err, 'db.collection("eventbuckets")');

if (argv._.length)
  optimist.showHelp();

// Perform query.
Step(
  function() {
    log('[');
    var OID = db.bson_serializer.ObjectID;
    var it = eventbuckets.find({
      _id: { $gte: OID(argv.vehicleId + '0000000000000000'),
             $lte: OID(argv.vehicleId + 'ffffffffffffffff') } });
    cursorIterate(it, function(eventBucket) {
      eventBucket._id = eventBucket._id.toString();
      log(indent('  ', insp(eventBucket)) + ',');
    }, this);
  }, function(err) {
    log(']');
    if (err)
      debug('error: ' + err + '\n' + err.stack);
    // Flush stdout.
    process.stdout.once('close', function() {
      process.exit(0);
    });
    process.stdout.destroySoon();
  }
);

})});
