#!/usr/bin/env node

// Add samples in real-time for testing real-time following.

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
    .describe('channelName', 'Channel name to insert')
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

var prevEnd = Date.now() * 1000, prevVal = 0;

setInterval(function() {
  var beg = prevEnd, end = Date.now() * 1000;
  var sampleSet = {
    _schema: [ {
      beg: prevEnd, end: end,
      val: { channelName: argv.channelName, type: 'float' }
    } ] };
  var count = 100;
  sampleSet[argv.channelName] = [];
  for (var i = 0; i < count; ++i) {
    prevVal += Math.random() - 0.5;
    var newEnd = Math.round(beg + (end - beg) / count * i);
    sampleSet[argv.channelName].push(
        { beg: prevEnd, end: newEnd, val: prevVal });
    prevEnd = newEnd;
  }
  log('Inserting ' + argv.channelName + ': ' +
      JSON.stringify(sampleSet[argv.channelName]));
  sampleDb.insertSamples(argv.vehicleId, sampleSet, function(err) {
    if (err) log('insertSamples error: ' + (err.stack || err));
  });
}, 1000);

})});
