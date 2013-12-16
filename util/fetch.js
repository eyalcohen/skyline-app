#!/usr/bin/env node
/*
 * fetch.js: fetch samples.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('did', 'Dataset ID')
      .demand('did')
    .describe('channelName', 'Channel name')
      .demand('channelName')
    .describe('min', 'Minimum sample duration')
      .demand('min')
    .describe('beg', 'Begin time in microseconds')
      .default('beg', null)
    .describe('end', 'End time in microseconds')
      .default('end', null)
    .describe('minmax', 'Get min max')
      .boolean('minmax')
    .describe('resample', 'Resample samples')
      .boolean('resample')
    .describe('stddev', 'Standard deviation')
      .default('stddev', false)
    .describe('index', 'Ensure indexes on MongoDB collections')
      .boolean('index')
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var com = require('../lib/common');
var resources = require('../lib/resources');
var Samples = require('../lib/samples').Samples

// Handle Execution of fetch sample queues.
function ExecutionQueue(maxInFlight) {
  var inFlight = 0;
  var queue = [];
  function done() {
    --inFlight;
    while (queue.length && inFlight < maxInFlight) {
      var f = queue.shift();
      ++inFlight;
      f(done);
    }
  }
  return function (f) {
    if (inFlight < maxInFlight) {
      ++inFlight;
      f(done);
    } else
      queue.push(f);
  };
}

// Constructor
var Client = exports.Client = function (samples) {
  this.samples = samples;

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);
}

Client.prototype.fetchSamples =
    function (did, channelName, options, cb) {

  util.debug(color.bgBlackBright.white.bold('fetchSamples:'));
  util.debug(color.blackBright('  datasetId   = ')
      + color.green.bold(did));
  util.debug(color.blackBright('  channelName = ')
      + color.cyan.bold(channelName));
  if (options.beginTime)
    util.debug(color.blackBright('  beginTime   = ')
        + color.yellow.bold(options.beginTime));
  if (options.endTime)
    util.debug(color.blackBright('  endTime   = ')
        + color.yellow.bold(options.endTime));
  if (options.minDuration)
    util.debug(color.blackBright('  minDuration = ')
        + color.blue.bold(options.minDuration));
  if (options.getMinMax)
    util.debug(color.blackBright('  getMinMax   = ')
        + color.magenta.bold(options.getMinMax));

  // Handle fetching with queues.
  this.sampleDbExecutionQueue(_.bind(function (done) {
    function next(err, samples) {
      cb(err, samples);
      done();
    };
    this.samples.fetchSamples(did, channelName, options, next);
  }, this));
}

boots.start({index: argv.index}, function (params) {
  var client = new Client(params.samples);
  var options = {
    begTime: argv.beg,
    endTime: argv.end,
    minDuration: argv.min,
    getMinMax: argv.minmax
  };

  // Fetch the samples.
  client.fetchSamples(Number(argv.did), argv.channelName, options,
      function (err, data) {
    boots.error(err);

    if (argv.resample)
      data = SampleDb.resample(data, argv.beg, argv.end,
          argv.resample, {stddev: argv.stddev});

    // Print samples.
    util.debug(color.blackBright('  sampleCount = ')
        + color.red.bold(data.length));
    util.debug(color.blackBright('  samples = '));
    _.each(data, function (s) {
      var str = color.blackBright('    ' + s.beg + ' - ' + s.end + ' --> ')
        + color.bold(s.val);
      if (s.min && s.max)
        str += ' (min = ' + color.bold(s.min)
            + ', max = ' + color.bold(s.max) + ')';
      util.debug(str);
    });

    process.exit(0);
  });
  
});
