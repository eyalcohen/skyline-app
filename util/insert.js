#!/usr/bin/env node

// Insert to sample DB.

var vm = require('vm');
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
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

function readEntireStream(stream, cb) {
  var r = '';
  stream.setEncoding('utf8');
  stream.on('data', function(data) { r += data; });
  stream.on('end', function() { cb(r); });
  stream.resume();
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

// Perform insert.
Step(
  function() {
    readEntireStream(process.stdin, this);
  }, function(stdin) {
    log('Got ' + stdin.length + ' characters from stdin.');
    //console.log(util.inspect(stdin));
    var sampleSet = vm.runInNewContext('(\n' + stdin + '\n)', {}, 'stdin');
    console.time('insertSamples');
    sampleDb.insertSamples(argv.vehicleId, sampleSet, this);
    //console.log(util.inspect(sampleSet));
    //this();
  }, function(err) {
    console.timeEnd('insertSamples');
    if (err)
      log('error: ' + err + '\n' + err.stack);
    process.exit(0);
  }
);

})});
