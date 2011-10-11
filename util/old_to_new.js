#!/usr/bin/env node

// Convert old-style eventbucket data into samples.json.

var vm = require('vm');
var log = require('console').log;
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var mongodb = require('mongodb');
var _ = require('underscore');

var printSamples = require('./print_samples.js').printSamples;
var compatibility = require('../compatibility.js');

var optimist = require('optimist');
var argv = optimist
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

function doWork(work, next)
{ (function f() { if (!work.length) next(); else (work.shift())(f); })(); }


if (argv._.length)
  optimist.showHelp();

// Perform queries.
Step(
  function() {
    readEntireStream(process.stdin, this);
  }, function(stdin) {
    debug('Got ' + stdin.length + ' characters from stdin.');
    //console.log(util.inspect(stdin));
    var eventBuckets = vm.runInNewContext('(\n' + stdin + '\n)', {}, 'stdin');

    // Dummy sampleDb to capture converted data.
    var sampleSet = {};
    var sampleDb = {
      insertSamples: function(vehicleId, newSampleSet, cb) {
        _.forEach(newSampleSet, function(samples, channelName) {
          sampleSet[channelName] =
              (sampleSet[channelName] || []).concat(samples);
        });
      },
    };

    eventBuckets.forEach(function(eventBucket) {
      eventBucket._id =
          mongodb.BSONPure.ObjectID.createFromHexString(eventBucket._id);
      compatibility.insertEventBucket(sampleDb, eventBucket, errCheck);
    });

    printSamples(sampleSet, this);
  }, function(err) {
    if (err)
      log('error: ' + err + '\n' + err.stack);
    if (argv.subscribe == null) {
      // Flush stdout.
      process.stdout.once('close', function() {
        process.exit(0);
      });
      process.stdout.destroySoon();
    }
  }
);
