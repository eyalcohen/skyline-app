// Functionality for saving samples to the DB.

// var log = require('./log.js').log;
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var shared = require('./shared_utils');


/**
 * Description of samples.  A sample is an Object with the following fields:
 *   veh: vehicleId.  (Often implicit.)
 *   chn: channel name.  (Often implicit.)
 *   beg: starting time of sample in us since the epoch, inclusive.
 *   end: ending time of sample in us since the epoch, exclusive.
 *   val: sample value - type determined by schema.
 *   min,max: for numeric values in synthetic samples.
 *
 * There are some special meta-channels:
 *   Schema samples:
 *     chn: '_schema'
 *     val: {
 *       channelName: channel name, e.g. "frontWheel.speed_m_s^2".
 *       humanName: human-readable channel name, e.g. "Front wheel speed".
 *       units: string describing units, e.g. "m/s^2".
 *       description: long human-readable description (optional).
 *       type: the type of the channel, one of:
 *           'float', 'int', 'enum', 'bitfield', 'object'.
 *       enumVals: if type == 'enum', an object mapping from enum value to name.
 *       bitfieldBits: if type == 'bitfield', an object mapping from zero-based
 *           bit number to bit name.
 *       channelNumber: number - device-specific channel number - lower numbers
 *           appear earlier in channel list.
 *       order: number - DEPRECATED - lower numbers appear earlier in channel
 *           list.
 *       sampleCount: number of samples contained over this time range.
 *       sampleDuration: total duration of samples over this time range.
 *       merge: true if samples which abut or overlap and have the same val
 *           should be merged into a single sample.
 *     }
 *   Wake level:
 *     chn: '_wake'
 *     val: an integer, where >= 1 indicates that the system is in an active
 *         state where the user is likely to be interested in the data.  For
 *         example, for an electric motorcycle, we might use:
 *           0: key is off, bike is sleeping.  Data is infrequent and less
 *              likely to interesting to a person.
 *           1: key is on, throttle is not live.
 *           2: throttle is live, bike has not moved since key turned on.
 *           3: throttle is live and bike has moved.
 *   Notifications:
 *     chn: '_error', '_warning', '_charge', '_drive'?
 *     beg, end: time range to which notification applies - can be
 *         zero-duration for errors and warnings.
 *     val: {
 *       humanName: human-readable short description,
 *           e.g. "Motor Controller Overcurrent Fault".
 *       description: optional longer description of notification.
 *       channels: optional array of channel names related to this
 *           notification (e.g. [ 'mc/fault.activeFaults[hard]' ]).
 *       ... notification-specific data?:
 *         charge: kWh added, charger type, outlet type, latlng?
 *         drive: kWh delta, distance travelled
 *         error, warning: channels containing relevant further data
 *     }
 *     TODO: Are _wake and _drive redundant?  Who creates these things?
 *   Notes:
 *     chn: '_note'
 *     beg, end: time range to which note applies - can be zero-duration
 *     val: {
 *       text: string - text of the note.  (No HTML!)
 *       tags: array[string] - list of tags?
 *       userEmail: string - email address of user who added comment.
 *       date: date - comment time/date.
 *     }
 */


var SampleDb = exports.SampleDb = function(db, options, cb) {
  var self = this;
  self.db = db;
  self.realCollections = {};
  self.syntheticCollections = {};

  Step(
    // Get all of the collections, in parallel.
    function getCollections() {
      var genNext = this.group();
      _.each(bucketThresholds, function(level) {
        var next = genNext();
        db.collection('real_' + level, function(err, collection) {
          self.realCollections[level] = collection;
          next(err);
        });
      });
      _.each(syntheticDurations, function(duration) {
        var next = genNext();
        db.collection('syn_' + duration, function(err, collection) {
          self.syntheticCollections[duration] = collection;
          next(err);
        });
      });
    },

    function ensureIndexes(err) {
      if (err || !options.ensureIndexes) {
        this(err);
      } else {
        var parallel = this.parallel;
        _.each(_.values(self.realCollections), function(collection) {
          collection.ensureIndex(
              {  // Index terms.
                veh: 1,  // Vehicle id.
                chn: 1,  // Channel name.
                buk: 1,  // Bucket number.
              },
              parallel());
        });
        _.each(_.values(self.syntheticCollections), function(collection) {
          collection.ensureIndex(
              {  // Index terms.
                veh: 1,  // Vehicle id.
                chn: 1,  // Channel name.
                buk: 1,  // Bucket number.
              },
              parallel());
        });
      }
    },

    function done(err) {
      if (err)
        cb(err);
      else
        cb(err, self);
    }
  );
}


function deltaEncodeInPlace(array) {
  var delta = 0;
  for (var i = 0, len = array.length; i < len; ++i) {
    array[i] -= delta;
    delta += array[i];
  }
  return array;
}

function deltaDecodeInPlace(array) {
  var delta = 0;
  for (var i = 0, len = array.length; i < len; ++i) {
    delta += array[i];
    array[i] = delta;
  }
  return array;
}


function execInGroups(groupSize, functions, cb) {
  var firstErr = null, fIndex = 0, len = functions.length, completed = 0;
  if (!len) return cb();
  function done(err) {
    firstErr = firstErr || err;
    if (++completed == len)
      cb(firstErr);
  }
  (function execSome() {
    for (var i = 0; i < groupSize && fIndex < len; ++i, ++fIndex) {
      try {
        functions[fIndex](done);
      } catch (err) {
        done(err);
      }
    }
    if (fIndex < len)
      process.nextTick(execSome);
  })();
}


function chain(functions, cb) {
  var firstErr = null, fIndex = 0, len = functions.length;
  (function execSome() {
    if (fIndex == len) {
      cb();
    } else try {
      functions[fIndex++](function(err) {
        if (err)
          cb(err);
        else
          process.nextTick(execSome);
      });
    } catch (err) {
      cb(err);
    }
  })();
}


function def0(val) { return (val == null) ? 0 : val; }

/**
 * Insert a set of samples into the DB.
 */
SampleDb.prototype.insertSamples = function(vehicleId, sampleSet, options, cb) {
  var self = this;
  if (_.isFunction(options) && cb == null) {
    cb = options;
    options = {};
  }
  _.defaults(options, {
    merge: true,
  });

  var toExec = [], toExecAfter = [];

  // TODO: verify that sampleSet is well-formed!

  //console.time('insertSamples');
  // Collect all _schema samples, mapped by channel name.
  // TODO: this assumes that each channel has no more than one schema in a
  // call to insertSamples.
  var schemaSet = {};
  (sampleSet['_schema'] || []).forEach(function(sample) {
    if (!sample.val || !sample.val.channelName) {
      debug('insertSamples got _schema sample with no channelName: ' +
            JSON.stringify(sample));
    } else {
      var channelSamples = sampleSet[sample.val.channelName];
      if (!('sampleDuration' in sample.val) && channelSamples) {
        // Create a duration and sample count for this channel.
        sample.val.sampleCount = channelSamples.length;
        sample.val.sampleDuration = _.reduce(channelSamples,
            function(sum, s) { return sum + s.end - s.beg }, 0);
      }
      schemaSet[sample.val.channelName] = sample;
    }
  });

  // TODO: merging should play well with synthetic samples!

  var channelNames = Object.keys(sampleSet);
  Step(
    function mergeDbQuery() {
      // If we're merging, we need to query and figure out what to delete
      // before figuring out inserts.
      var parallel = this.parallel;
      if (options.merge) {
        channelNames.forEach(function(channelName) {
          var chanSchema = schemaSet[channelName] || { val: {} };
          if (chanSchema.val.merge || channelName == '_schema') {
            var next = parallel();
            // Merge _schema samples if they're within an hour to avoid
            // excessive samples.
            var expandBy = channelName == '_schema' ? SampleDb.h : 0;
            self.queryForMerge(
                vehicleId, channelName, sampleSet[channelName], expandBy,
                function (err, mergedSamples, redundantSamples) {
              if (err) { next(err); return; }
              sampleSet[channelName] = mergedSamples;
              redundantSamples.forEach(function (redundant) {
                toExecAfter.push(function(cb) {
                  self.deleteRealSample(vehicleId, channelName, redundant, cb);
                });
              });
              next();
            });
          }
        });
      }
      parallel()();  // Go on to next step now if we forked no work.
    },

    function finishInserting(err) {
      if (err)
        debug('Error during insertSamples.mergeDbQuery: ' + err.stack);

      channelNames.forEach(function(channelName) {
        var chanSchema = schemaSet[channelName] || { val: {} };
        var type = chanSchema.val.type;
        var merge = chanSchema.val.merge || false;

        // Organize samples by real[levelIndex+'-'+bucket] = [ samples ].
        // Create synthetic in syn[synDuration+'-'+synBucket] = synSample.
        var real = {}, syn = {}, topLevelReal = [];
        sampleSet[channelName].forEach(function(sample) {
          // Push real sample.
          var levelInfo = SampleDb.getLevelInfo(sample);
          var levelIndex = levelInfo.levelIndex;
          var topLevel = levelIndex == bucketThresholds.length - 1;
          if (topLevel) {
            topLevelReal.push(sample);
          } else {
            var realKey = levelIndex + '-' + levelInfo.minBucket;
            var samples = real[realKey];
            if (!samples)
              samples = real[realKey] = [];
            samples.push(sample);
          }

          // Update synthetic samples.
          if (_.isNumber(sample.val) && sample.end > sample.beg) {
            SampleDb.forSyntheticSamples(sample.beg, sample.end,
                function(synBucket, synDuration, overlap) {
              var index = synBucket % syntheticSamplesPerRow;
              var synRow = (synBucket - index) / syntheticSamplesPerRow;
              var synKey = synDuration + '-' + synRow;
              var val = sample.val;
              var synSample = syn[synKey];
              if (!synSample) {
                synSample = syn[synKey] = {
                  sum: new Array(syntheticSamplesPerRow),
                  ovr: new Array(syntheticSamplesPerRow),
                  min: new Array(syntheticSamplesPerRow),
                  max: new Array(syntheticSamplesPerRow),
                };
              }
              synSample.sum[index] = def0(synSample.sum[index]) + val * overlap;
              synSample.ovr[index] = def0(synSample.ovr[index]) + overlap;
              if (synSample.min[index] == null || val < synSample.min[index])
                synSample.min[index] = val;
              if (synSample.max[index] == null || val > synSample.max[index])
                synSample.max[index] = val;
            });
          }
        });

        // Insert bucketed real samples into DB.
        _.values(real).forEach(function(bucketSamples) {
          var levelInfo = SampleDb.getLevelInfo(bucketSamples[0]);
          var sample = {
            veh: vehicleId,
            chn: channelName,
            buk: levelInfo.minBucket,
            beg: deltaEncodeInPlace(_.pluck(bucketSamples, 'beg')),
            end: deltaEncodeInPlace(_.pluck(bucketSamples, 'end')),
            val: _.pluck(bucketSamples, 'val'),
          };
          toExec.push(function(cb) {
            self.realCollections[levelInfo.level].insert(
                sample, { safe: true }, cb);
            //console.timeEnd('insertReal');
          });
        });

        // Insert top level real samples into DB.
        topLevelReal.forEach(function(topLevelSample) {
          var levelInfo = SampleDb.getLevelInfo(topLevelSample);
          var buckets = levelInfo.minBucket == levelInfo.maxBucket ?
              levelInfo.minBucket :
              _.range(levelInfo.minBucket, levelInfo.maxBucket + 1);
          var sample = {
            veh: vehicleId,
            chn: channelName,
            buk: buckets,
            beg: topLevelSample.beg,
            end: topLevelSample.end,
            val: topLevelSample.val,
          };
          toExec.push(function(cb) {
            self.realCollections[levelInfo.level].insert(
                sample, { safe: true }, cb);
            //console.timeEnd('insertReal');
          });
        });

        // Insert synthetic samples into DB.
        Object.keys(syn).forEach(function(key) {
          var synSample = syn[key];
          var s = key.split('-');
          var synDuration = Number(s[0]), synRow = Number(s[1]);

          // Ensure synthetic row exists before attempting to modify it.
          var synCollection = self.syntheticCollections[synDuration];
          var query = {
            veh: vehicleId,
            chn: channelName,
            buk: synRow,
          };
          toExec.push(function(cb) {
            Step(
              function findAndEnsureExists() {
                synCollection.findAndModify(
                    query,
                    [], // Sort.
                    { // Update:
                      $pushAll: {
                        sum: [],
                        ovr: [],
                        min: [],
                        max: [],
                      },
                    }, { // Options:
                      upsert: true, // Insert if not found.
                      new: true, // Return modified object.
                    },
                    this);
              }, function tryUpdate(err, original) {
                if (!original) {
                  debug('IMPOSSIBLE: insertSamples.tryUpdateMinMax got null!');
                  process.exit(1);
                  return;
                }
                var modified = _.clone(original);
                modified.sum = _.clone(original.sum);
                modified.ovr = _.clone(original.ovr);
                modified.min = _.clone(original.min);
                modified.max = _.clone(original.max);
                
                for (var i = 0; i < syntheticSamplesPerRow; ++i) {
                  if (synSample.sum[i] != null) {
                    modified.sum[i] = def0(modified.sum[i]) + synSample.sum[i];
                    modified.ovr[i] = def0(modified.ovr[i]) + synSample.ovr[i];
                    if (modified.min[i] == null ||
                        synSample.min[i] < modified.min[i])
                      modified.min[i] = synSample.min[i];
                    if (modified.max[i] == null ||
                        synSample.max[i] > modified.max[i])
                      modified.max[i] = synSample.max[i];
                  }
                }
                synCollection.findAndModify(original, [], modified,
                                            function(err, o) {
                  if (o) {
                    // Update succeeded!
                    // console.timeEnd('insertSyn');
                    cb();
                  } else {
                    // If o is null, then the sample was modified by somebody
                    // else before we managed to update, so try again.
                    // log('Update race in insertSamples.tryUpdate, retrying.');
                    synCollection.findOne(query, tryUpdate);
                  }
                });
              }
            );
          });
        });
      });
      //console.timeEnd('insertSamples');
      //console.time('insertReal');
      //console.time('insertSyn');

      // Execute all queued up operations 10 at a time, to avoid blocking for an
      // excessive amount of time talking to the DB.
      execInGroups(10, toExec, function(err) {
        if (err) cb(err);
        else execInGroups(10, toExecAfter, cb);
      });
    }
  );
}


SampleDb.prototype.queryForMerge =
    function(vehicleId, channelName, newSamples, expandBy, cb) {
  var self = this;
  if (!newSamples.length)
    return cb(null, newSamples, []);
  var redundant;
  Step(
    function() {
      // Get real samples which might overlap with the samples we're adding.
      self.fetchSamples(vehicleId, channelName,
                        { type: 'real',
                          beginTime: _.first(newSamples).beg - expandBy - 1,
                          endTime: _.last(newSamples).end + expandBy + 1,
                        }, this);
    }, function(err, dbSamples) {
      if (err) { cb(err); return; }
      // Figure out which samples to add to db, and which existing samples to
      // delete.
      dbSamples.forEach(function(s) { s.indb = true; });
      // Note: the following looks efficient, but when dbSamples is really big,
      // it blows the call stack.  Doh!
      //Array.prototype.push.apply(newSamples, dbSamples);
      newSamples = newSamples.concat(dbSamples);
      sortSamplesByTime(newSamples);
      //console.log('*** newSamples: ', newSamples);
      redundant = mergeOverlappingSamples2(newSamples, channelName, expandBy);
      //console.log('--- redundant: ', redundant);
      //console.log('--- samples: ', newSamples);
      var merged = newSamples.filter(function(s) { return s && !s.indb; });
      this(null, merged, redundant);
    }, cb
  );
}


SampleDb.prototype.addDurationHeuristicHack =
    function(vehicleId, sampleSet, maxDuration, cb) {
  // This is a hack to add duration to samples which are of zero duration.
  // The algorithm is: for each zero-duration sample, set the begin time to the
  // end of the previous sample, unless that duration exceeds maxDuration.
  // Note that if the first sample of each channel has no duration, we have to
  // query the DB for the previous sample!
  var self = this;
  var prevSampleSet = {};
  Step(
    function() {
      // For any channel we might need to synthesize an initial begin, get
      // potentially overlapping data.
      var parallel = this.parallel;
      _.each(sampleSet, function(samples, channelName) {
        var first = _.first(samples);
        if (first && first.beg == first.end) {
          var next = parallel();
          options = { type: 'real',
                      beginTime: first.beg - maxDuration, endTime: first.beg };
          self.fetchSamples(vehicleId, channelName, options,
                            function(err, samples) {
            prevSampleSet[channelName] = samples;
            if (err)
              // log('Error in addDurationHeuristicHack while fetching: ' +
                  // (err.stack || err));
            next();
          });
        }
      });
      parallel()();
    },
    function(err) {
      if (err) { this(err); return; }
      _.each(sampleSet, function(samples, channelName) {
        var prevEnd = -Number.MAX_VALUE;
        if (prevSampleSet[channelName] && _.last(prevSampleSet[channelName]))
          prevEnd = _.last(prevSampleSet[channelName]).end;
        samples.forEach(function(s) {
          if (s.end <= s.beg) {
            // Synthesize a duration for this sample.
            var dur = Math.max(Math.min(maxDuration, s.beg - prevEnd), 0);
            s.beg -= dur;
          }
          prevEnd = s.end;
        });
      });
      this(null);
    },
    cb
  );
}


/**
 * Delete a sample from the database.
 *
 * Warning: this currently doesn't handle synthetic samples at all, so it
 * should only be applied to samples which are redundant, or which are
 * non-numeric and thus don't generate synthetic samples.
 */
SampleDb.prototype.deleteRealSample =
    function(vehicleId, channelName, sample, cb) {
  var levelInfo = SampleDb.getLevelInfo(sample);
  var query = {
    veh: vehicleId,
    chn: channelName,
    buk: levelInfo.minBucket,
  };
  var collection = this.realCollections[levelInfo.level];
  Step(
    function() {
      var parallel = this.parallel;
      cursorIterate(collection.find(query), function(rawSample) {
        expandRealSample(rawSample, function(s, i) {
          if (s.beg == sample.beg && s.end == sample.end &&
              SampleDb.sampleValuesEqual(s.val, sample.val)) {
            // Found it!  Delete!
            if (i == null || rawSample.val.length == 1) {
              // This sample is the only one in this row - delete row.
              collection.remove({ _id: rawSample._id },
                                { safe: true }, parallel());
            } else {
              // Null out value.
              var unset = { };
              unset['val.' + i] = 1;
              collection.update({ _id: rawSample._id }, { $unset: unset },
                                { safe: true }, parallel());
              // TODO: we could use findAndModify to re-write the sample without
              // this value, but it's not clear that this would be worthwhile.
            }
          }
        });
      }, parallel());
    }, cb
  );
}


function expandRealSample(sample, f) {
  if (_.isArray(sample.val)) {
    var beg = 0, end = 0; // Delta decoding ad-hoc for speed.
    for (var i = 0, len = sample.val.length; i < len; ++i) {
      beg += sample.beg[i];
      end += sample.end[i];
      var val = sample.val[i];
      if (val != null)
        f({ beg: beg, end: end, val: val }, i);
    }
  } else {
    if (sample.val != null)
      f(sample);
  }
}


SampleDb.prototype.fetchRealSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
  if (_.isFunction(options) && cb == null) {
    cb = options;
    options = {};
  }
  _.defaults(options, {
    beginTime: null, endTime: null,
    minDuration: 0,
  });
  var beginTime = options.beginTime, endTime = options.endTime;
  var minLevel = SampleDb.getLevel(options.minDuration);

  var samples = [];
  Step(
    // Get real samples in parallel.
    function() {
      var parallel = this.parallel;

      // Get overlapping real samples.
      bucketThresholds.forEach(function(level, levelIndex) {
        if (level >= minLevel) {
          var bucketSize = SampleDb.bucketSizes[levelIndex];
          var query = { veh: vehicleId, chn: channelName };
          if (beginTime != null || endTime != null) {
            query.buk = { };
            if (beginTime != null) {
              var begQueryTime = beginTime;
              // Tricky: because buckets are only determined based on the
              // beginning of each sample, we need to expand our query range by
              // the maximum size of a sample at this level, which is the size
              // of the next level.  The exception is the top level.
              if (levelIndex < bucketThresholds.length - 1)
                begQueryTime -= bucketThresholds[levelIndex + 1];
              query.buk.$gte = Math.floor(begQueryTime / bucketSize);
            }
            if (endTime != null) {
              query.buk.$lt = Math.ceil(endTime / bucketSize);
            }
          }
          //debug('level: ' + level + ', query: ' + JSON.stringify(query));
          var fields = {
            _id: 0,  // No need for _id.
            beg: 1, end: 1, val: 1,
          };
          cursorIterate(self.realCollections[level].find(query, fields),
                        function(rawSample) {
            // debug('level: ' + level + ', rawSample: ' + inspect(rawSample.val));
            expandRealSample(rawSample, function(sample) {
              // Ignore samples which don't overlap our time range.
              if ((beginTime == null || beginTime < sample.end) &&
                  (endTime == null || sample.beg < endTime)) {
                samples.push(sample);
              }
            });
          }, parallel());
        }
      });
    },

    function(err) {
      if (err) { cb(err); return; }
      sortSamplesByTime(samples);  // Could do merge sort...
      cb(err, samples);
    }
  );
}


SampleDb.prototype.fetchSyntheticSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
  if (_.isFunction(options) && cb == null) {
    cb = options;
    options = {};
  }
  _.defaults(options, {
    beginTime: null, endTime: null,
    synDuration: 0,
    getMinMax: false,
  });
  var beginTime = options.beginTime, endTime = options.endTime;
  var synDuration = options.synDuration;

  // Get overlapping synthetic samples with appropriate duration.
  var samples = [];
  var query = { veh: vehicleId, chn: channelName };
  if (beginTime != null || endTime != null) {
    query.buk = { };
    if (beginTime != null)
      query.buk.$gte =
          Math.floor(beginTime / synDuration / syntheticSamplesPerRow);
    if (endTime != null)
      query.buk.$lt =
          Math.ceil(endTime / synDuration / syntheticSamplesPerRow);
  }
  var fields = {
    _id: 0,  // No need for _id.
    buk: 1,
    sum: 1,
    ovr: 1,
  };
  if (options.getMinMax) {
    fields.min = 1;
    fields.max = 1;
  }
  // Include veh and chn to ensure index-based sorting.
  var sort = [ 'veh', 'chn', 'buk' ];
  cursorIterate(
      self.syntheticCollections[synDuration].find(
          query, { fields: fields, sort: sort }), function(synSample) {
    var synBegin = synSample.buk * synDuration * syntheticSamplesPerRow;
    for (var i = 0; i < syntheticSamplesPerRow; ++i) {
      var sum = synSample.sum[i], ovr = synSample.ovr[i];
      if (sum != null && ovr != null) {
        var beg = synBegin + i * synDuration, end = beg + synDuration;
        // Ignore samples which don't overlap our time range.
        if ((beginTime == null || beginTime < end) &&
            (endTime == null || beg < endTime)) {
          var sample = { beg: beg, end: end, val: sum / ovr };
          if (options.getMinMax) {
            sample.min = synSample.min[i];
            sample.max = synSample.max[i];
          }
          samples.push(sample);
        }
      }
    }
  }, function(err) { cb(err, samples); });
}


SampleDb.prototype.fetchMergedSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
  if (_.isFunction(options) && cb == null) {
    cb = options;
    options = {};
  }
  _.defaults(options, {
    beginTime: null, endTime: null,
    minDuration: 0,
    getMinMax: false,
  });
  var getMinMax = options.getMinMax;

  // Special case.
  if (options.minDuration == 0) {
    return self.fetchRealSamples(vehicleId, channelName, options, cb);
  }

  var synDuration = options.synDuration =
      SampleDb.getSyntheticDuration(options.minDuration);
  // Note: we must get samples which are longer than synDuration, since
  // those are all samples which didn't contribute to the synthetic
  // samples.  However, in the case that minDuration is less than the
  // smallest synthetic duration, we should get samples above minDuration
  // too.
  options.minDuration = Math.min(synDuration, options.minDuration);

  Step(
    // Get real samples and synthetic samples in parallel.
    function() {
      self.fetchRealSamples(vehicleId, channelName, options, this.parallel());

      // Get overlapping synthetic samples with appropriate duration.
      self.fetchSyntheticSamples(vehicleId, channelName, options,
                                 this.parallel());
    },

    // Merge real and synthetic samples.
    function(err, realSamples, synSamples) {
      if (err) { cb(err); return; }

      if (!synSamples || synSamples.length == 0) {
        this(null, realSamples);
        return;
      }

      // Compute synthetic averages by bucket.
      var synBegin = Math.floor(_.first(synSamples).beg / synDuration);
      var synEnd = Math.ceil(_.last(synSamples).end / synDuration);
      var synAverages = new Array(synEnd - synBegin);
      var synMin = getMinMax && new Array(synEnd - synBegin);
      var synMax = getMinMax && new Array(synEnd - synBegin);
      synSamples.forEach(function(s) {
        var i = s.beg / synDuration - synBegin;
        synAverages[i] = s.val;
        if (getMinMax) {
          synMin[i] = s.min;
          synMax[i] = s.max;
        }
      });

      // For each gap in real data, add synthetic data if available.
      var gapSamples = [];
      // Use beginning and end of synthetic range, so that we don't chop up
      // synthetic samples at beginning & end.
      SampleDb.forSampleGaps(
          realSamples, synBegin * synDuration, synEnd * synDuration,
          function(gapBegin, gapEnd) {
        // NOTE: this gets very slow if we're querying over a large time range,
        // even if there's little synthetic data.  Fortunately, the web front
        // end should only request a reasonable number of samples.  If we
        // wanted to make this scale to a large number of buckets, we'd want
        // to do some kind of binary range search over synSamples.
        var bukBegin = Math.floor(gapBegin / synDuration);
        var bukEnd = Math.ceil(gapEnd / synDuration);
        for (var buk = bukBegin; buk < bukEnd; ++buk) {
          var i = buk - synBegin;
          var avg = synAverages[i];
          if (avg != null) {
            var beg = buk * synDuration;
            var s = {
              beg: Math.max(gapBegin, beg),
              end: Math.min(gapEnd, beg + synDuration),
              val: avg,
            };
            if (synMin && synMin[i] != null)
              s.min = synMin[i];
            if (synMax && synMax[i] != null)
              s.max = synMax[i];
            gapSamples.push(s);
          }
        }
      });
      Array.prototype.push.apply(realSamples, gapSamples);
      sortSamplesByTime(realSamples);  // Could do merge sort...
      this(null, realSamples);
    },

    cb
  );
}


SampleDb.prototype.fetchSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
  if (_.isFunction(options) && cb == null) {
    cb = options;
    options = {};
  }
  _.defaults(options, {
    type: 'merged',  // or 'real' or 'synthetic'
    beginTime: null, endTime: null,
    minDuration: 0,
    getMinMax: false,
    subscribe: null,  // pass polling interval in seconds to subscribe.
  });

  function fetchInternal(cb) {
    if (options.type == 'synthetic')
      self.fetchSyntheticSamples(vehicleId, channelName, options, cb);
    else if (options.type == 'real' || !options.minDuration)
      self.fetchRealSamples(vehicleId, channelName, options, cb);
    else
      self.fetchMergedSamples(vehicleId, channelName, options, cb);
  };

  if (options.subscribe != null) {
    var realEndTime = options.endTime;
    var subscriptionToken = {
      timeoutId: setTimeout(checkForSamples, 0),
      cancel: false,
    };
    function checkForSamples() {
      subscriptionToken.timeoutId = null;
      if (subscriptionToken.cancel) return;
      fetchInternal(function(err, samples) {
        if (err) { cb(err); return; }
        if (subscriptionToken.cancel) return;
        if (samples && samples.length) {
          cb(err, samples);
          // Update beginTime to exclude the samples we just got.
          options.beginTime = _.last(samples).end;
          if (options.endTime != null && options.beginTime >= options.endTime)
            // Nothing more to fetch.
            return;
        }
        // Wait for more samples.
        subscriptionToken.timeoutId = setTimeout(checkForSamples,
                                                 options.subscribe * 100);
      });
    };
    return subscriptionToken;
  } else {
    fetchInternal(cb);
  }
}


SampleDb.prototype.cancelSubscription = function(subscriptionToken) {
  subscriptionToken.cancel = true;
  if (subscriptionToken.timeoutId != null)
    clearTimeout(subscriptionToken.timeoutId);
}


function filter2(array, test, trueElems) {
  return array.filter(function(elem) {
    if (test(elem)) {
      trueElems.push(elem);
      return false;
    }
    return true;
  });
}


function copyProperties(to, from, props) {
  for (var i in props) {
    var p = props[i];
    if (p in from)
      to[p] = from[p];
  }
}


function ifNull(val, def) { return val == null ? def : val }
function compare(a,b) {
  // Return a - b doesn't function correctly when a or b are very large, e.g.
  // Infinity.
  return a < b ? -1 : a > b ? 1 : 0;
}


// Remove consecutive duplicate elements from array.
function deepUnique(array) {
  return _.reduce(array, function(memo, el, i) {
    if (0 == i || !SampleDb.sampleValuesEqual(_.last(memo), el))
      memo.push(el);
    return memo;
  }, []);
};


/**
 * Build a channel description tree from a list of schema samples.
 *
 * @result A channel description tree, e.g.:
 * [
 *   { shortName: 'gps.',
 *     humanName: 'GPS data',  // optional
 *     description: 'GPS data from dash unit.',  // optional
 *     type: 'category',
 *     sub: [
 *       { shortName: 'latitude_deg',
 *         channelName: 'gps.latitude_deg',
 *         humanName: 'Latitude',  // optional
 *         units: '°',  // optional
 *         type: 'float',  // optional
 *         valid: [ { beg: 123, end: 678, per: 10 }, ... ],
 *       },
 *       ...
 *     ],
 *   },
 *   { shortName: 'mc/',
 *     humanName: 'Motor Controller',  // optional
 *     type: 'category',
 *     sub: ...
 *   },
 * ]
 * Average sample period represented by per.
 */
// Split on:
//   - A . or /, and include the . or / in the prefix.
//   - A [ or ], don't include [ in the prefix.
var prefixRe = /^(.[^./\[\]]*[./\]]*).*?$/;
SampleDb.buildChannelTree = function(samples) {

  function buildInternal(samples, prefix, depth) {
    var result = [];
    while (samples.length > 0) {
      var s = _.first(samples);
      var shortName = s.val.channelName.substr(prefix.length);
      var m = shortName.match(prefixRe);
      var nextPrefix = m && (m[1] !== shortName) && m[1];
      var desc;
      if (!nextPrefix) {
        // This is a terminal.
        // Find all samples with the same channelName.
        var same = [];
        samples = filter2(samples, function(s2) {
          return s2.val.channelName == s.val.channelName;
        }, same);
        sortSamplesByTime(same);
        s = _.last(same);  // Use the latest.
        // Copy channelName and such in.
        desc = {shortName: shortName};
        _.extend(desc, s.val);
        delete desc.sampleDuration;
        delete desc.sampleCount;
        if (_.isArray(desc.humanName)) {
          desc.humanName = desc.humanName[depth];
          if (desc.humanName == null) delete desc.humanName;
        }
        // TODO: interval sets to union together ranges?
        desc.valid = same.map(function(s2) {
          var v = { beg: s2.beg, end: s2.end };
          if ('sampleDuration' in s2.val)
            v.per = s2.val.sampleDuration / s2.val.sampleCount;
          return v;
        });
      } else {
        // New category.
        var humanName = null;
        var subHumanName = samples[0].val.humanName;
        if (_.isArray(subHumanName) && depth < subHumanName.length)
          humanName = subHumanName[depth];
        // Remove all samples which start with the given prefix.
        var sub = [], subPrefix = prefix + nextPrefix;
        samples = filter2(samples, function(s) {
          return _.startsWith(s.val.channelName, subPrefix);
        }, sub);
        desc = {
          shortName: nextPrefix,
          type: 'category',
          sub: buildInternal(sub, subPrefix, depth + 1),
        };
        // Don't bother with valid for categories, since GUI doesn't use it.
        //desc.valid = [].concat.apply([], _.pluck(desc.sub, 'valid'));
        //sortSamplesByTime(desc.valid);
        //desc.valid = deepUnique(desc.valid);
        if (humanName) desc.humanName = humanName;
      }
      result.push(desc);
    }
    // TODO: Remove duplicates?
    return result;
  }
  var sortedSamples = _.clone(samples);
  sortedSamples.sort(function(a, b) {
    return compare(ifNull(a.val.order, Infinity),
                   ifNull(b.val.order, Infinity)) ||
           compare(ifNull(a.val.channelNumber, Infinity),
                   ifNull(b.val.channelNumber, Infinity)) ||
           compare(a.val.channelName, b.val.channelName);
  });
  var descriptionTree = buildInternal(sortedSamples, '', 0);
  return descriptionTree;
}

/**
 * Merge samples which are adjacent or overlapping and share a value.
 *
 * Cases to get right:
 *   1. If two DB samples are identical or a DB and non-DB sample are
 *      identical, don't mark either redundant (no unique key to delete one).
 *   2. If a record is identical to or subsumes another record, delete the
 *      other record.
 *   3. If two samples can be merged into a larger sample, do so and mark both
 *      redundant.
 *
 * @param samples Array of incoming samples, sorted by begin time.  Modified!
 *   Samples in DB should have .indb = true.
 * @return An array of DB samples which were made redundant.  Redundant indb
 *   samples should be deleted from DB.
 */
function mergeOverlappingSamples2(samples, channelName, expandBy) {
  var redundant = [];
  // Index of first sample which might overlap current sample.
  var mightOverlap = 0;

  for (var i = 0; i < samples.length; ++i) {
    var s = samples[i];
    // Skip ahead until mightOverlap is a sample which could possibly overlap.
    while (mightOverlap < samples.length &&
           (!samples[mightOverlap] ||
            samples[mightOverlap].end + expandBy < s.beg))
      ++mightOverlap;
    for (var j = mightOverlap; j < i; ++j) {
      var t = samples[j];
      if (!t) continue;
      var merged = SampleDb.tryMergeSamples(s, t, channelName, expandBy);
      if (!merged) continue;
      var identical = s.beg == t.beg && s.end == t.end &&
          SampleDb.sampleValuesEqual(t.val, s.val);
      // Samples overlap.  Merge them somehow and delete one.
      if (identical && t.indb) {
        // 1. If two DB samples are identical, don't delete either from DB
        // (no unique key).
        samples[i] = null;  // Delete s from samples.
      } else if (identical && s.indb) {
        // 1. If a DB and non-DB sample are identical, don't mark either
        // redundant.
        samples[j] = null;  // Delete t from samples.
      } else if (s.beg <= t.beg && s.end >= t.end) {  // s subsumes t.
        // 2. If a record is identical to or subsumes another record, delete
        // the other record.
        if (t.indb) redundant.push(t);
        if (!SampleDb.sampleValuesEqual(s.val, merged.val)) {
          samples[i] = merged;
          if (s.indb) redundant.push(s);
        }
        samples[j] = null;  // Delete t from samples.
      } else if (t.beg <= s.beg && t.end >= s.end) {  // t subsumes s.
        // 2. If a record is identical to or subsumes another record, delete
        // the other record.
        if (s.indb) redundant.push(s);
        if (!SampleDb.sampleValuesEqual(t.val, merged.val)) {
          samples[j] = merged;
          if (t.indb) redundant.push(t);
        }
        samples[i] = null;  // Delete s from samples.
      } else {
        if (s.indb) redundant.push(s);
        if (t.indb) redundant.push(t);
        samples[j] = merged;
        samples[i] = null;  // Delete s from samples.
      }
      break;
    }
  }
  return redundant;
}


//// Constants and utility functions: ////


_.extend(SampleDb, shared);  // Merge in all functionality from shared_utils.js.

// These are used a lot, copy them locally for convenience.
var bucketThresholds = SampleDb.bucketThresholds;
var syntheticDurations = SampleDb.syntheticDurations;
var syntheticSamplesPerRow = SampleDb.syntheticSamplesPerRow;


/**
 * In an array, return the index of the last element which passes test.
 */
function lastMatch(v, test) {
  var l = v.length;
  var i;
  for (i = 1; i < l; ++i) {
    if (!test(v[i]))
      break;
  }
  return i - 1;
}


/**
 * Get the level for a given duration.
 */
SampleDb.getLevelIndex = function(duration) {
  return lastMatch(bucketThresholds, function(minDuration) {
    return duration >= minDuration;
  });
};

SampleDb.getLevel = function(duration) {
  return bucketThresholds[SampleDb.getLevelIndex(duration)];
};

SampleDb.getLevelInfo = function(sample) {
  var i = SampleDb.getLevelIndex(sample.end - sample.beg);
  var bucketSize = SampleDb.bucketSizes[i];
  return {
    level: bucketThresholds[i],
    levelIndex: i,
    bucketSize: bucketSize,
    minBucket: Math.floor(sample.beg / bucketSize),
    maxBucket: Math.ceil(sample.end / bucketSize) - 1,
  };
};


/**
 * Get the level for a given duration.
 */
SampleDb.getSyntheticDuration = function(duration) {
  var i = lastMatch(syntheticDurations, function(synDuration) {
    return duration >= synDuration;
  });
  return syntheticDurations[i];
};


/**
 * Get the buckets for a given time & duration.
 *
 * @param cb{Function}<br>
 *   cb(begin, duration, overlap)
 */
SampleDb.forSyntheticSamples = function(beginTime, endTime, cb) {
  var duration = endTime - beginTime;
  // Find the next bigger bucket level than the one this sample would go into.
  var nextBucketIndex = SampleDb.getLevelIndex(duration) + 1;
  var minDuration = bucketThresholds[nextBucketIndex];
  if (minDuration == null) minDuration = duration;
  syntheticDurations.forEach(function(synDuration) {
    if (minDuration < synDuration) {
      var synBucket = Math.floor(beginTime / synDuration);
      var synBegin = synBucket * synDuration;
      var synEnd = synBegin + synDuration;
      if (endTime <= synEnd) {
        // Real sample contributes to one synthetic sample.
        cb(synBucket, synDuration, duration);
      } else {
        // Real sample contributes to two synthetic samples.
        cb(synBucket, synDuration, synEnd - beginTime);
        cb(synBucket + 1, synDuration, endTime - synEnd);
      }
    }
  });
};


SampleDb.forSampleGaps = function(samples, beginTime, endTime, cb) {
  // Samples must be sorted!
  var l = samples.length;
  function space(beg, end) {
    if (end > beg)
      cb(beg, end);
  }
  if (!l) {
    // Special case - no samples.
    space(beginTime, endTime);
  } else {
    space(beginTime, samples[0].beg);
    for (var i = 0; i < l - 1; ++i) {
      space(samples[i].end, samples[i+1].beg);
    }
    space(samples[i].end, endTime);
  }
};


var sortSamplesByTime = SampleDb.sortSamplesByTime =
    function(samples, reverse) {
  reverse = reverse ? -1 : 1;
  samples.sort(function(a, b) {
    return reverse * (compare(a.beg, b.beg) || compare(a.end, b.end));
  });
};

/**
 * Generate samples at a new resolution.
 * @param startTime
 * @param options
 * @returns A new SampleSeries with the synthetic data.
 */
SampleDb.resample = function(inSamples, beg, end, sampleSize, options) {
  options = options || {};
  _.defaults(options, {
    stddev: false,
    keepAll: false,
  });

  var sampleCount = Math.ceil((end - beg) / sampleSize);
  var result = new Array(sampleCount);

  function forEachSampleOverlap(cb) {
    inSamples.forEach(function(s) {
      var begin = Math.max(0, Math.floor((s.beg - beg) / sampleSize));
      var end = Math.min(sampleCount,
                         Math.ceil((s.end - beg) / sampleSize));
      for (var i = begin; i < end; ++i) {
        var sampleStart = beg + i * sampleSize;
        var sampleEnd = sampleStart + sampleSize;
        var overlap =
            Math.min(sampleEnd, s.end) - Math.max(sampleStart, s.beg);
        cb(i, s, overlap, sampleStart, sampleEnd);
      }
    });
  }

  // Compute sums and overlaps.
  forEachSampleOverlap(function(n, s, weight, sampleStart, sampleEnd) {
    var r = result[n], val = s.val;
    var min = s.min != null ? s.min : s.val;
    var max = s.max != null ? s.max : s.val;
    if (!r) {
      r = result[n] = {
        beg: sampleStart,
        end: sampleEnd,
        sum: 0,
        ovr: 0,
      };
    } else {
      if (r.min == null)
        r.min = r.max = r.sum / r.ovr;
      r.min = Math.min(r.min, val);
      r.max = Math.max(r.max, val);
    }
    r.sum += val * weight;
    r.ovr += weight;
  });

  // Compute variance.
  if (options.stddev) {
    forEachSampleOverlap(function(n, s, weight) {
      var r = result[n];
      var delta = s.val - r.sum / r.ovr;
      r.stddev = (r.stddev || 0) + delta * delta * weight; // Actually variance.
    });
  }

  // Modify to expected form.
  result.forEach(function(s) {
    if (s) {
      s.val = s.sum / s.ovr;
      if (options.stddev) {
        s.stddev = Math.sqrt(s.stddev / s.ovr);
      }
      delete s.sum;
      delete s.ovr;
    }
  });

  // Return, without any empty entries.
  if (!options.keepAll)
    result = _.reject(result, _.isUndefined);
  return result;
};


/**
 * Reorganize a sampleSet into a list of samples which occur with the same
 * begin and end times.
 *
 * @param sampleSet Mapping from channel name to sample arrays.  Sample arrays
 *     must be sorted by time.
 * @return Array of maps from channel name to samples.
 */
var groupSamplesByTime = SampleDb.groupSamplesByTime = function(sampleSet) {
  var channels = _.keys(sampleSet);
  var cur = {};
  channels.forEach(function(channelName) { cur[channelName] = 0; });
  var result = [];
  while (true) {
    // Find the earliest times.
    var minBeg = null, minEnd = null;
    channels.forEach(function(channelName) {
      var s = sampleSet[channelName][cur[channelName]];
      if (s && (minBeg == null || s.beg < minBeg ||
                (s.beg == minBeg && s.end < minEnd))) {
        minBeg = s.beg;
        minEnd = s.end;
      }
    });
    if (minBeg == null)
      break;

    // Move samples with same time into result.
    var sameSamples = {};
    channels.forEach(function(channelName) {
      var s = sampleSet[channelName][cur[channelName]];
      if (s && s.beg == minBeg && s.end == minEnd) {
        sameSamples[channelName] = s;
        ++cur[channelName];
      }
    });
    result.push(sameSamples);
  }
  return result;
}


/**
 * Iterate through all values on a cursor, calling a function for each row,
 * and a different callback when done.  Warning: if the rowCb function is not
 * syncronous, then there's no guaruntee that all rows have been fully
 * processed when doneCb is called.
 *
 * @param cursor{MongoDb.Cursor} The cursor to iterate.
 * @param rowCb{function(rowData)} Function called on each row.
 * @param doneCb{function(err)} Function called on completion.
 */
var cursorIterate = function(cursor, rowCb, doneCb) {
  var stream = cursor.stream();
  stream.on('data', rowCb);
  stream.on('close', function() { doneCb(null); });
  stream.on('error', doneCb);
}
