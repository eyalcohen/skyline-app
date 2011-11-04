#!/usr/bin/env node

// Insert to sample DB.

var vm = require('vm');
var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var byline = require('byline');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-samples')
    .demand('vehicleId')
    .demand('station')  // e.g. ERM
    .demand('channel')  // e.g. BHZ
    .default('batchSamples', 50000)
    .describe('maxdur', 'Maximum sample duration.')
      .default('maxdur', 1 / 19)
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

function errStep(op) {
  return function(err) {
    errCheck(err, op);
    if (_.isFunction(this)) {
      this.apply(this, _.toArray(arguments).slice(1));
    }
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

var lineNumber = 0;
var pendingSamples = [];
var samplesInserted = 0;
var pendingInserts = 0;
var done = false;

process.stdin.setEncoding('utf8');
var inStream = byline.createLineStream(process.stdin);
// Example line:
//   2011-02-31T07:53:22.964300              888
// The month seems to be zero-based rather than one-based - ugh!
var lineRegex = /^([0-9]+)-([0-9]+)-([0-9]+)T([0-9]+):([0-9]+):([0-9]+)\.([0-9]{6})  *([-+.eE0-9]+)$/;
inStream.on('data', function(line) {
  ++lineNumber;
  var m = line.match(lineRegex);
  if (!m) {
    log('Line ' + lineNumber + ': ' + line);
  } else {
    var year = m[1], month = Number(m[2]) + 1, day = m[3];
    var hour = m[4], minute = m[5], second = m[6], useconds = m[7];
    var ms = Date.parse(
        year + '-' + month + '-' + day + ' ' +
        hour + ':' + minute + ':' + second + ' UTC');
    var us = ms * 1000 + Number(useconds);
    if (isNaN(us)) {
      log('Line ' + lineNumber + ': Could not parse time: ' + line);
      return;
    }
    var val = Number(m[8]);
    if (isNaN(val)) {
      log('Line ' + lineNumber + ': Could not parse value ' + m[8]);
      return;
    }
    pendingSamples.push({ beg: us, end: us, val: val });
    if (pendingSamples.length >= argv.batchSamples)
      insertPending();
  }
});
inStream.on('end', function() {
  done = true;
  insertPending();
});
process.stdin.resume();

function insertPending() {
  if (!pendingSamples.length) return;
  ++pendingInserts;
  // log('Starting insert of ' + pendingSamples.length + ' samples; ' +
      // pendingInserts + ' inserts pending.');
  var startTime = Date.now();
  process.stdin.pause();  // TODO: this won't stop byline from emitting for a while.
  var channelName = argv.station + '.' + argv.channel;
  var samples = pendingSamples;
  var sampleSet = {};
  sampleSet[channelName] = samples;
  pendingSamples = [];
  Step(
    function addDurations() {
      sampleDb.addDurationHeuristicHack(
          argv.vehicleId, sampleSet, Math.ceil(argv.maxdur * 1e6), this);
    }, errStep('addDurationHeuristicHack'),

    function addSchema() {
      sampleSet._schema = [ {
        beg: _.first(samples).beg,
        end: _.last(samples).end,
        val: {
          channelName: channelName,
          humanName: [ 'Seismo station ' + argv.station,
                       'Channel ' + argv.channel ],
          type: 'int',
          merge: false,
        }
      } ];
      sampleSet._wake = [ {
        beg: _.first(samples).beg,
        end: _.last(samples).end,
        val: 1,
      } ];
      this();
    }, errStep('addSchema'),

    function insertSamples() {
      sampleDb.insertSamples(argv.vehicleId, sampleSet, this);
    }, errStep('insertSamples'),

    function() {
      samplesInserted += samples.length;
      log('Inserted ' + samples.length + ' samples in ' +
          (Date.now() - startTime) / 1e3 + 's; total ' +
          samplesInserted + ' samples.');
      if (!done) process.stdin.resume();
      if (--pendingInserts == 0 && done) {
        // Flush stdout.
        process.stdout.once('close', function() { process.exit(0); });
        process.stdout.destroySoon();
      }
    }, errStep('')
  );
}

})});

