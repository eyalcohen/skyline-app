#!/usr/bin/env node

// Convert a .csv file to a collection of samples.

var CSV = require('csv');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var log = console.log;
var _ = require('underscore');
var printSamples = require('./print_samples.js').printSamples;
var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .describe('ignore', 'Names of columns to ignore.')
      .default('ignore', [ 'Seconds', 'Date', 'Time', 'Excel Time', 'xxx' ])
    .describe('date', 'sprintf format string to create Date object.')
      .default('date', 'new Date("%(Date)s %(Time)s UTC")')
      // .default('date', 'new Date(%(Time)s + 7*60*60*1000)')
    .describe('maxdur', 'Maximum sample duration.')
      .default('maxdur', 0.25)
    .argv;

function errStep(op) {
  return function(err) {
    if (err) {
      debug('Error during ' + op + ':\n' + err.stack);
      process.exit(1);
    }
    if (_.isFunction(this))
      this.apply(this, arguments);
  }
}

if (argv.ignore == null)
  argv.ignore = [];
else if (!_.isArray(argv.ignore))
  argv.ignore = [ argv.ignore ];
argv.ignore.push(argv.date);
argv.ignore.push(argv.time);

Step(
  function readCsv() {
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    var sampleSet = {};
    var next = this;
    var prevEnd = -Number.MAX_VALUE;
    var csv = CSV()
      .fromStream(process.stdin, { columns: true })
      .on('data', function(data, index) {
        var line = index + 2;
        try {
          var dateString = _.sprintf(argv.date, data);
          var date = eval(dateString);
          var end = date.valueOf() * 1e3;
        } catch (e) {
          errStep('Line ' + line + ': could not parse "' + dateString + '"')(e);
        }
        var dur = end - prevEnd;
        if (dur > argv.maxdur * 1e6) {
          if (index > 0)
            debug('Line ' + line + ': duration ' + (dur / 1e6) +
                  ' > maxdur ' + argv.maxdur);
          dur = argv.maxdur * 1e6;
        }
        if (dur <= 0)
          errStep('Line ' + line + ': time went backward')(new Error);
        var beg = end - dur;
        prevEnd = end;
        _.each(data, function(value, key) {
          if (!_.contains(argv.ignore, key) && value != null && value != '') {
            if (!sampleSet[key]) sampleSet[key] = [];
            // Strip anything after a colon.
            value = value.match(/^([^:]*)/)[1];
            sampleSet[key].push({ beg: beg, end: end, val: Number(value) });
          }
        });
      })
      .on('end', function(lines) {
        next(null, csv.readOptions.columns, sampleSet);
      })
      .on('error', errStep('CSV read from stdin'));
  }, errStep('readCsv'),

  function writeSamples(err, columns, sampleSet) {
    // Merge samples.
    debug('Merging samples.');
    _.forEach(sampleSet, SampleDb.mergeOverlappingSamples);

    // Add dummy schema samples.
    var schema = sampleSet['_schema'] = [];
    var order = 1;
    columns.forEach(function(channelName) {
      var samples = sampleSet[channelName];
      if (!samples) return;
      var m = channelName.match(/^(.*) \(([^()]+)\)$/);
      var v = {
        beg: _.first(samples).beg,
        end: _.last(samples).end,
        val: {
          channelName: channelName,
          humanName: m ? m[1] : channelName,
          type: 'float',
          merge: true,
          order: order++,
        },
      };
      if (m) v.val.units = m[2];
      schema.push(v);
    });

    printSamples(sampleSet, this);
  }, errStep('writeSamples'),

  function() {
    debug('Done!');
    // Flush stdout.
    process.stdout.once('close', function() {
      process.exit(0);
    });
    process.stdout.destroySoon();
  }
)
