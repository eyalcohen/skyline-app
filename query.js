#!/usr/bin/env node

// Query from sample DB.

var log = require('console').log;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var SampleDb = require('./sample_db.js').SampleDb, toNumber = SampleDb.toNumber;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo://localhost:27017/service-samples')
    .boolean('real')
    .boolean('synthetic')
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
      var next = parallel();

      if (argv.real) {
        sampleDb.fetchRealSamples(argv.vehicleId, channelName, _.clone(argv),
                                  function(err, realSamples) {
          if (err) { next(err); return; }
          try {
            printSamples(realSamples, 'Real samples');
          } catch (err) { next(err); return; }
          next();
        });

      } else if (argv.synthetic) {
        if (argv.synDuration == null) {
          argv.synDuration =
              SampleDb.getSyntheticDuration(argv.minDuration || 0);
        }
        sampleDb.fetchSyntheticSamples(argv.vehicleId, channelName,
                                       _.clone(argv), function(err, synSamples) {
          if (err) { next(err); return; }
          try {
            printSamples(synSamples, 'Synthetic samples');
          } catch (err) { next(err); return; }
          next();
        });

      } else /* merged */ {
        if (_.isUndefined(argv.beginTime) || _.isUndefined(argv.endTime)) {
          optimist.showHelp();
          next();
          return;
        }
        sampleDb.fetchMergedSamples(argv.vehicleId, channelName, _.clone(argv),
                                    function(err, mergedSamples) {
          if (err) { next(err); return; }
          try {
            printSamples(mergedSamples, 'Merged samples');
          } catch (err) { next(err); return; }
          next();
        });
      }


      function printSamples(samps, desc) {
        log('\nChannel ' + channelName + ':');
        if (argv.resample) {
          samps = SampleDb.resample(samps, argv.beginTime, argv.endTime,
                                    argv.resample, { stddev: argv.stddev });
          log('  ' + desc + ', resampled to ' + argv.resample + ':');
        } else {
          log('  ' + desc + ':');
        }
        SampleDb.sortSamplesByTime(samps);
        samps.forEach(function(s, i) {
          var beg = toNumber(s.beg);
          var end = toNumber(s.end);
          log('    ' + beg + ' .. ' + end + ' (' + (end - beg) + '): ' +
              util.inspect(s.val) +
              (_.isUndefined(s.min) ? '' : ' (' + s.min + '...' + s.max + ')') +
              (_.isUndefined(s.stddev) ? '' : ' (' + s.stddev + ')'));
          var nextSample = samps[i+1];
          var nextBeg = nextSample && toNumber(nextSample.beg);
          if (nextBeg && nextBeg < end)
            log('    !!! overlap (' + (end - nextBeg) + ') !!!');
          if (nextBeg && nextBeg > end)
            log('    !!! gap (' + (nextBeg - end) + ') !!!');
        });
      }

    });
    parallel()();
  },
  done
);

function done(err) {
  if (err)
    debug('done error:\n' + err.stack);

  // Flush stdout.
  process.stdout.once('close', function() {
    process.exit(0);
  });
  process.stdout.destroySoon();
}

})});
