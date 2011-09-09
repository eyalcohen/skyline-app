#!/usr/bin/env node

// Query from sample DB.

var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var SampleDb = require('./sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-samples')
    .default('type', 'merged')
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
new SampleDb(db, { ensureIndexes: false }, function (err, sampleDb) {
errCheck(err, 'new sampleDb');

if (!argv._.length)
  optimist.showHelp();

// Perform queries.
Step(
  function() {
    var parallel = this.parallel;
    argv._.forEach(function(channelName) {
      var next = argv.subscribe == null ? parallel() : _.identity;

      if (argv.synDuration == null)
        argv.synDuration = SampleDb.getSyntheticDuration(argv.minDuration || 0);

      sampleDb.fetchSamples(
          argv.vehicleId, channelName, _.clone(argv), function(err, samples) {
        if (err) { next(err); return; }
        try {
          printSamples(samples, argv.type);
        } catch (err) { next(err); return; }
        next();
      });

      function printSamples(samps, desc) {
        log('\nChannel ' + channelName + ':');
        if (argv.resample) {
          samps = SampleDb.resample(samps, argv.beginTime, argv.endTime,
                                    argv.resample, { stddev: argv.stddev });
          log('  ' + desc + ', resampled to ' + argv.resample + ':');
        } else {
          log('  ' + desc + ':');
        }
        samps.forEach(function(s, i) {
          log('    ' + s.beg + ' .. ' + s.end + ' (' + (s.end - s.beg) + '): ' +
              util.inspect(s.val) +
              (_.isUndefined(s.min) ? '' : ' (' + s.min + '...' + s.max + ')') +
              (_.isUndefined(s.stddev) ? '' : ' (' + s.stddev + ')'));
          var nextSample = samps[i+1];
          var nextBeg = nextSample && nextSample.beg;
          if (nextBeg && nextBeg < s.end)
            log('    !!! overlap (' + (s.end - nextBeg) + ') !!!');
          if (nextBeg && nextBeg > s.end)
            log('    !!! gap (' + (nextBeg - s.end) + ') !!!');
        });
      }

    });
    parallel()();
  }, function(err) {
    if (err)
      debug('error: ' + err + '\n' + err.stack);
    if (argv.subscribe == null) {
      // Flush stdout.
      process.stdout.once('close', function() {
        process.exit(0);
      });
      process.stdout.destroySoon();
    }
  }
);

})});
