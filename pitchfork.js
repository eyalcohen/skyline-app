#!/usr/bin/env node

// Transfer data from old DB format to new DB format.

var log = require('console').log;
var debug = require('util').debug;
var mongodb = require('mongodb').native();
var Step = require('step');
var util = require('util');
var _ = require('underscore');

var SampleDb = require('./sample_db.js').SampleDb;

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
                  db: { native_parser: false },
                }, function(err, srcDb) {
errCheck(err, 'connect('+argv.srcDb+')');
srcDb.collection(argv.srcCollection, function(err, srcCollection) {
errCheck(err, 'srcDb.collection('+argv.srcCollection+')');

// Connect to dest DB, samples collection.
mongodb.connect(argv.destDb, {
                  server: { poolSize: 4 },
                  db: { native_parser: false },
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
try {
  log('Processing a drive cycle', doc._id, 'with',
      doc.events.length, 'events...');

  var vehicleId =
      mongodb.BinaryParser.decodeInt(doc._id.id.substring(4,8), 32, true, true) * 1000 +
      mongodb.BinaryParser.decodeInt(doc._id.id.substring(8,10), 16, true, true);
  log('Vehicle id is', vehicleId);

  // If not marked valid, ignore.
  if (!doc.valid) {
    processDoc();
    return;
  }

  // Sort into different sample types.
  var sampleSets = {};
  _.each(doc.events, function(event) {
    function addSample(name, value) {
      if (_.isUndefined(value))
        return;
      var s = sampleSets[name];
      if (!s)
        s = sampleSets[name] = [];
      var header = event.header;
      // Arrgh, stopTime seems to be useless - sometimes it's before startTime.
      s.push({
        beg: header.startTime.toNumber() * 1000,
        // end: header.stopTime.toNumber() * 1000,
        val: value,
      });
    }

    if (event.header.type == 'LOCATION' &&
        event.header.source == 'SENSOR_GPS') {
      addSample('gps.speed_m_s', event.location.speed);
      addSample('gps.latitude_deg', event.location.latitude);
      addSample('gps.longitude_deg', event.location.longitude);
      addSample('gps.altitude_m', event.location.altitude);
      addSample('gps.accuracy_m', event.location.accuracy);
      addSample('gps.bearing_deg', event.location.bearing);
    } else if (event.header.type == 'SENSOR_DATA' &&
               event.header.source == 'SENSOR_ACCEL') {
      addSample('accel.x_m_s2', event.sensor[0]);
      addSample('accel.y_m_s2', event.sensor[1]);
      addSample('accel.z_m_s2', event.sensor[2]);
    }
  });

  // Hack: Henson seems to always send stopTime == startTime, so synthesize
  // reasonable durations.
  _.each(_.values(sampleSets), function(s) {
    SampleDb.sortSamplesByTime(s);  // Sometimes Henson data is out of order. !!!
    var total = 0;
    s.forEach(function(sample, index) {
      var nextSample = s[index + 1];
      if (nextSample) {
        if (!sample.end)
          sample.end = nextSample.beg;
        total += sample.end - sample.beg;
      } else {
        // Store average duration in last sample, so it has something.
        if (!sample.end && index)
          sample.end = sample.beg + Math.ceil(total / index);
      }
    });
  });

  // Write data to dest DB.
  var cycleStart = Number.MAX_VALUE, cycleEnd = Number.MIN_VALUE;
  var sampleCount = 0
  _.each(_.keys(sampleSets), function(channelName) {
    sampleSets[channelName].forEach(function(sample) {
      sampleDb.insertSample(vehicleId, channelName,
                            sample.beg, sample.end, sample.val);
      cycleStart = Math.min(cycleStart, sample.beg);
      cycleEnd = Math.max(cycleEnd, sample.end);
      ++sampleCount;
    });
  });
  printBufferSize();

  // Add drive cycle event to dest DB.
  sampleDb.insertSample(vehicleId, '_cycle', cycleStart, cycleEnd, {
                          sampleCount: sampleCount,
                        });

  //process.stdout.write(util.inspect(doc, false, 100));
  /*
  var repl = require('repl').start();
  repl.context.doc = doc;
  repl.context.sampleSets = sampleSets;
  */
} catch (err) {
  debug('Error processing event:\n' + err.stack);
  process.exit(1);
}

// On to next drive cycle.
process.nextTick(processDoc);

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
