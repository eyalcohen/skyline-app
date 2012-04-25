#!/usr/bin/env node

// Convert a .csv file to a collection of samples.

var CSV = require('csv');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var log = console.log;
var _ = require('underscore');
_.mixin(require('underscore.string'));
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
    .describe('addChannel', 'Add fixed-value channel: --addChannel=name=value')
    .argv;

function errStep(op) {
  return function(err) {
    if (err) {
      debug('Error during ' + op + ':\n' + (err.stack || err));
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

var firstBeg = Infinity, lastEnd = -Infinity;

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
        if (dur <= 0) {
          debug('Line ' + line + ': time went backward');
          return;
        }
        var beg = end - dur;
        firstBeg = Math.min(firstBeg, beg);
        lastEnd = Math.max(lastEnd, end);
        prevEnd = end;
        _.each(data, function(value, key) {
          if (!_.contains(argv.ignore, key) && value != null && value != '') {
            if (!sampleSet[key]) sampleSet[key] = [];
            value = value.match(/^([^:]*)/)[1]; // Strip anything after a colon.
            if (value.match(/^(NaN|)$/i))
              return;  // Ignore blanks and NaNs.
            var val = Number(value);
            if (isNaN(val))
              errStep('Line ' + line + ': could not parse column ' + key +
                      ': "' + value + '"')(true);
            sampleSet[key].push({ beg: beg, end: end, val: val });
          }
        });
      })
      .on('end', function(lines) {
        next(null, csv.readOptions.columns, sampleSet);
      })
      .on('error', errStep('CSV read from stdin'));
  }, errStep('readCsv'),

  function writeSamples(err, columns, sampleSet) {
    // Add channels.
    if (!_.isArray(argv.addChannel))
      argv.addChannel = argv.addChannel ? [ argv.addChannel ] : [];
    argv.addChannel.forEach(function(chan) {
      var m = chan.match(/^(.+) *= *([^=]+)$/);
      errStep("Can't parse --addChannel '" + chan + "'")(!m);
      var val = eval('(' + m[2] + ')');
      sampleSet[m[1]] = [ { beg: firstBeg, end: lastEnd, val: val } ];
    });

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
      if (m) v.val.units = m[2].replace('_', '/');
      schema.push(v);
    });

    debug('Printing samples.');
    printSamples(sampleSet, this);
  }, errStep('writeSamples'),

  function() {
    debug('Done!');
    /*
    setTimeout(this, 1000);  // Ugh
  },

  function() {
  */
    process.exit(0);
  }
)
