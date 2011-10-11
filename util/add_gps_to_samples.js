#!/usr/bin/env node

// Add GPS data to existing sampleSet.

var vm = require('vm');
var fs = require('fs');
var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var printSamples = require('./print_samples.js').printSamples;
var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('laps', '[ ' +
             '[0, 0], ' +             // Start line?
             '[534.03, 2314+70], ' +     // Turn 2, warm-up.
             '[3577.7, 14463+70], ' +    // Start line.
             '[4122.3, 16700+70], ' +    // Turn 2, lap 1.   14386
             '[7701.4, 31250+70], ' +    // Turn 2, lap 2.   14550
             '[11278.7, 45740+70], ' +   // Turn 2, lap 3.  14490
             '[14856.0, 60300+70], ' +   // Turn 2, lap 4.  14560
             '[18432.7, 74760+70], ' +   // Turn 2, lap 5.  14460
             '[22008.8, 89220+70], ' +   // Turn 2, lap 6.  14460
             '[25588.0, 103690+70], ' +  // Turn 2, lap 7. 14470
             '[29167.1, 118165+70], ' +  // Turn 2, lap 8. 14475
             '[32744.4, 133000+70], ' +  // Turn 2, lap 9? 14835
             ']')
    .default('dist', 'mc/motorRevsSinceBoot')
    .demand('gpsfile')  // GPS data file, with distances.
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

function readEntireStream(stream, cb) {
  var r = '';
  stream.setEncoding('utf8');
  stream.on('data', function(data) { r += data; });
  stream.on('end', function() { cb(null, r); });
  stream.on('error', function(err) { cb(err); });
  stream.resume();
}

function interpolate1d(input, output, val) {
  var prev = input[0];
  for (var i = 1; i < input.length; ++i) {
    var cur = input[i];
    if (val >= prev && val <= cur) {
      var frac = (val - prev) / (cur - prev);
      return output[i-1] + frac * (output[i] - output[i-1]);
    }
    prev = cur;
  }
  return null;
}


if (argv._.length)
  optimist.showHelp();

var sampleSet, gpsData, laps;
Step(
  function() {
    readEntireStream(process.stdin, this);
  }, errStep('readEntireStream(process.stdin)'),
  function(sampleStr) {
    debug('Got ' + sampleStr.length + ' characters from stdin.');
    sampleSet = vm.runInNewContext('(\n' + sampleStr + '\n)', {}, 'stdin');
    this();
  }, errStep('Parse sampleSet'),

  function() {
    readEntireStream(fs.createReadStream(argv.gpsfile), this);
  }, errStep('readEntireStream('+argv.gpsfile+')'),
  function(gpsStr) {
    debug('Got ' + gpsStr.length + ' characters from '+argv.gpsfile+'.');
    gpsData = vm.runInNewContext('(\n' + gpsStr + '\n)', {}, argv.gpsfile);
    this();
  }, errStep('Parse gpsData'),

  function() {
    laps = vm.runInNewContext('(' + argv.laps + ')', {}, 'laps');
    this();
  }, errStep('parse laps'),

  function() {
    var gpsBeg = Number.MAX_VALUE, gpsEnd = -Number.MAX_VALUE;
    var distSamples = sampleSet[argv.dist];
    var distI = 0;
    var prevEnd = null;
    var latSamples = sampleSet['gps.latitude_deg'] = [];
    var lngSamples = sampleSet['gps.longitude_deg'] = [];
    var altSamples = sampleSet['gps.altitude_m'] = [];
    var lapsI = _.pluck(laps, 0), lapsO = _.pluck(laps, 1);
    gpsData.forEach(function(gpsSample) {
      var targetDist = interpolate1d(lapsI, lapsO, gpsSample.dist);
      if (targetDist == null) return;
      while (distI < distSamples.length && targetDist > distSamples[distI].val)
        ++distI;
      if (distI == distSamples.length) return;
      if (prevEnd == null) prevEnd = distSamples[distI].beg;
      var beg = prevEnd, end = distSamples[distI].end;
      latSamples.push({ beg: beg, end: end, val: gpsSample.lat });
      lngSamples.push({ beg: beg, end: end, val: gpsSample.lng });
      altSamples.push({ beg: beg, end: end, val: gpsSample.alt });
      gpsBeg = Math.min(gpsBeg, beg);
      gpsEnd = Math.max(gpsEnd, end);
      prevEnd = end;
    });
    sampleSet['_schema'].push(
      { beg: gpsBeg, end: gpsEnd, val:
        { channelName: 'gps.latitude_deg', humanName: 'GPS Latitude',
          units: '°', type: 'float' } },
      { beg: gpsBeg, end: gpsEnd, val:
        { channelName: 'gps.longitude_deg', humanName: 'GPS Longitude',
          units: '°', type: 'float' } },
      { beg: gpsBeg, end: gpsEnd, val:
        { channelName: 'gps.altitude_m', humanName: 'GPS Altitude',
          units: 'm', type: 'float' } });
    this();
  }, errStep('Add GPS to sampleSet'),

  function writeSamples() {
    printSamples(sampleSet, this);
  }, errStep('writeSamples'),

  function() {
    // Flush stdout.
    process.stdout.once('close', function() {
      process.exit(0);
    });
    process.stdout.destroySoon();
  }
);
