#!/usr/bin/env node

// Dump contents of sample DB to files.

/***
 * You can dump users and vehicles with:
     mongoexport -d service-samples -c users > dump/users.json
     mongoexport -d service-samples -c vehicles > dump/vehicles.json
 * Restore with:
     mongoimport -d service-samples -c users --upsert < dump/users.json
     mongoimport -d service-samples -c vehicles --upsert < dump/vehicles.json
     for f in dump/vehicle.*.json.gz; do
       id=`expr "$f" : '.*\.\([-0-9]*\)\.json\.gz$'`
       gzcat $f | util/insert.js --vehicleId=$id
     done
*/

var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var gzbz2 = require('gzbz2');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var fs = require('fs');
var _ = require('underscore');

var SampleDb = require('../sample_db.js').SampleDb;
var printSamples = require('./print_samples.js').printSamples;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-samples')
    .describe('dir', 'Directory to dump into.')
      .default('dir', 'dump')
    .default('batchSamples', 50000)
    .describe('vehicleId', 'VehicleIds to dump, all by default.')
    .argv;

if (argv.vehicleId != null && !_.isArray(argv.vehicleId))
  argv.vehicleId = [ argv.vehicleId ];

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

var db, sampleDb;
var vehicles;

Step(

  function openDb() {
    mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
  }, errStep('openDb'), function(db_) { db = db_; return null; },
  function makeSampleDb() {
    debug('makeSampleDb');
    sampleDb = new SampleDb(db, { ensureIndexes: false }, this);
  }, errStep('makeSampleDb'),

  function openVehicles() {
    debug('openVehicles');
    db.collection('vehicles', { strict: true }, this);
  }, errStep('openVehicles'), function(c) { return vehicles = c; },

  function findVehicles() {
    debug('findVehicles');
    vehicles.find({}).toArray(this);
  }, errStep('findVehicles'),
  function dumpVehicles(vehicles) {
    debug('dumpVehicles');
    if (!vehicles.length) return this();
    dumpVehicle(_.first(vehicles), dumpVehicles.bind(this, _.rest(vehicles)));
  }, errStep('dumpVehicles'),

  function done() {
    debug('done');
    // Flush stdout.
    process.stdout.once('close', function() {
      process.exit(0);
    });
    process.stdout.destroySoon();
  }

);

function dumpVehicle(vehicle, callback) {
  var vehicleId = vehicle._id;
  if (argv.vehicleId && !_.contains(argv.vehicleId, vehicleId)) {
    debug('Ignoring vehicle ' + vehicleId);
    return;
  }
  var sampleSet = {};

  debug('Dumping vehicle ' + vehicleId);
  Step(
    function fetchSchema() {
      sampleDb.fetchRealSamples(vehicleId, '_schema', this);
    }, errStep('fetchSchema'),

    function fetchSamples(schema) {
      sampleSet._schema = schema;
      var channels = _(schema).chain()
          .pluck('val')
          .pluck('channelName')
          .sort()
          .uniq()
          .value();
      if (!channels.length) {
        debug('No data, skipping vehicle ' + vehicleId);
        callback();
        return;
      }
      StepArray(channels, function(channelName, cb) {
        if (channelName === '_schema') return cb();
        debug('Fetching channel ' + channelName);
        sampleDb.fetchRealSamples(vehicleId, channelName,
                                  function(err, samples) {
          if (samples) sampleSet[channelName] = samples;
          cb(err);
        });
      }, this);
    }, errStep('fetchSamples'),

    function mkdir() {
      fs.mkdir(argv.dir, 0777, this);
    }, /* ignore error from mkdir */
    function dumpSamples() {
      var path = argv.dir + '/' + vehicleId + '.json.gz';
      debug('Dumping to ' + path);
      var stream = fs.createWriteStream(path);
      var gzip = new gzbz2.Gzip;
      var buffer = new Buffer(50 * 1024);
      var bufferFilled = 0;
      function addToBuffer(str) {
        while (str.length) {
          bufferFilled += buffer.write(str, bufferFilled);
          if (Buffer._charsWritten === str.length &&
              bufferFilled < buffer.length)
            return;
          str = str.slice(Buffer._charsWritten);
          flushBuffer();
        }
      }
      function flushBuffer() {
        stream.write(gzip.deflate(buffer.slice(0, bufferFilled)));
        bufferFilled = 0;
      }
      gzip.init();
      stream.on('error', errStep('stream ' + path));
      stream.on('close', this);
      printSamples(sampleSet, function(line) {
        addToBuffer(line + '\n');
      }, function() {
        flushBuffer();
        stream.end(gzip.end());
      });
    }, errStep('dumpSamples'),

    callback
  );
}

function StepArray(array, f, cb) {
  var i = 0;
  (function step(err) {
    if (err) cb(err);
    else if (i >= array.length) cb();
    else f(array[i++], step);
  })();
}
