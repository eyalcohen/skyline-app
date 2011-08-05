// Functionality for saving samples to the DB.

var _ = require('underscore');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var Step = require('step');


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
 *       type: the type of the channel, one of: 'float', 'int', 'enum', 'object'.
 *       enumVals: if type == 'enum', a list of possible values for the enum.
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
 */


var SampleDb = exports.SampleDb = function(db, options, cb) {
  var self = this;
  self.db = db;
  self.sampleCollections = {};
  self.syntheticCollections = {};

  Step(
    // Get all of the collections, in parallel.
    function getCollections() {
      var genNext = this.group();
      _.each(bucketThresholds, function(level) {
        var next = genNext();
        db.collection('slice_' + level, function(err, collection) {
          self.sampleCollections[level] = collection;
          next(err);
        });
      });
      _.each(syntheticDurations, function(duration) {
        var next = genNext();
        db.collection('synthetic_' + duration, function(err, collection) {
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
        _.each(_.values(self.sampleCollections), function(collection) {
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


/**
 * Insert a set of samples into the DB.
 */
SampleDb.prototype.insertSamples = function(vehicleId, sampleSet, cb) {
  var self = this;
  var toExec = [];

  // Collect all _schema samples, mapped by channel name.
  // TODO: this assumes that each channel has no more than one schema in a
  // call to insertSamples.
  var schemaSet = {};
  (sampleSet['_schema'] || []).forEach(function(sample) {
    schemaSet[sample.val.channelName] = sample;
  });

  var channelNames = Object.keys(sampleSet);
  channelNames.forEach(function(channelName) {

    var chanSchema = schemaSet[channelName] || { val: {} };
    var type = chanSchema.val.type;
    var merge = chanSchema.val.merge || false;

    // Organize samples by real[levelIndex+'-'+bucket] = [ samples ].
    // Create synthetic samples in syn[synDuration+'-'+synBucket] = synSample.
    var real = {}, syn = {}, topLevelReal = [];
    sampleSet[channelName].forEach(function(sample) {
      // Push real sample.
      var levelInfo = getLevelInfo(sample.beg, sample.end);
      var levelIndex = levelInfo.levelIndex;
      var topLevel = levelIndex == bucketThresholds.length - 1;
      if (topLevel) {
        topLevelReal.push(sample);
      } else {
        var realKey = levelIndex + '-' + levelIndex.minBucket;
        var samples = real[realKey];
        if (!samples)
          samples = real[realKey] = [];
        samples.push(sample);
      }

      // Update synthetic samples.
      if (_.isNumber(sample.val)) {
        forSyntheticSamples(sample.beg, sample.end,
                            function(synBucket, synDuration, overlap) {
          var synKey = synDuration + '-' + synBucket;
          var synSample = syn[synKey];
          var val = sample.val;
          if (!synSample) {
            synSample = syn[synKey] = {
              sum: val * overlap,
              ovr: overlap,
              min: val,
              max: val,
            };
          } else {
            synSample.sum += val * overlap;
            synSample.ovr += overlap;
            if (val < synSample.min) synSample.min = val;
            if (val > synSample.max) synSample.max = val;
          }
        });
      }
    });

    // TODO: merge mergeable samples?

    // Insert bucketed real samples into DB.
    _.values(real).forEach(function(bucketSamples) {
      var levelInfo = getLevelInfo(bucketSamples[0].beg, bucketSamples[0].end);
      var sample = {
        veh: vehicleId,
        chn: channelName,
        buk: levelInfo.minBucket,
        beg: deltaEncodeInPlace(_.pluck(bucketSamples, 'beg')),
        end: deltaEncodeInPlace(_.pluck(bucketSamples, 'end')),
        val: _.pluck(bucketSamples, 'val'),
      };
      toExec.push(function(cb) {
        self.sampleCollections[levelInfo.level].insert
            (sample, { safe: true }, cb);
      });
    });

    // Insert top level real samples into DB.
    topLevelReal.forEach(function(topLevelSample) {
      var levelInfo = getLevelInfo(topLevelSample.beg, topLevelSample.end);
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
        self.sampleCollections[levelInfo.level].insert(
            sample, { safe: true }, cb);
      });
    });

    // Insert synthetic samples into DB.
    Object.keys(syn).forEach(function(key) {
      var synSample = syn[key];
      var s = key.split('-');
      var synDuration = Number(s[0]), synBucket = Number(s[1]);

      // Tricky cleverness to atomically and safely update min and max.
      var synCollection = self.syntheticCollections[synDuration];
      var query = {
        veh: vehicleId,
        chn: channelName,
        buk: synBucket,
      };
      toExec.push(function(cb) {
        Step(
          function updateAverage() {
            synCollection.findAndModify(
                query,
                [], // Sort.
                { // Update:
                  $inc: {
                    sum: synSample.sum,
                    ovr: synSample.ovr,
                  },
                  // Unfortunately, mongodb has no $min or $max operators.
                }, { // Options:
                  upsert: true, // Insert if not found.
                  new: true, // Return modified object.
                },
                this);
          }, function tryUpdateMinMax(err, original) {
            if (!original) {
              debug('IMPOSSIBLE: insertSamples.tryUpdateMinMax got null!');
              debug('db.synthetic_' + synDuration + '.findAndModify({' +
                    'query: ' + inspect(query) + 
                    ', update: ' + inspect( { // Update:
                        $inc: {
                          sum: synSample.sum,
                          ovr: synSample.ovr,
                        },
                        // Unfortunately, mongodb has no $min or $max operators.
                      }) +
                    ', upsert: true, new: true })');
              process.exit(1);
              return;
            }
            if (original.min == null)
              original.min = null;
            if (original.max == null)
              original.max = null;
            var modified = _.clone(original);
            if (modified.min == null || synSample.min < modified.min)
              modified.min = synSample.min;
            if (modified.max == null || synSample.max > modified.max)
              modified.max = synSample.max;
            synCollection.findAndModify(original, [], modified, function(err, o){
              if (o) {
                // Update succeeded!
                cb();
              } else {
                // If o is null, then the sample was modified by somebody else
                // before we managed to update, so try again.
                console.log('Update race in insertSamples.tryUpdateMinMax, retrying.');
                if (0) debug('db.synthetic_' + synDuration + '.findAndModify({' +
                      'query: ' + inspect(original) + 
                      ', update: ' + inspect(modified) +
                      ' }) => (' + err + ', ' + o + ')');
                if (0) debug('db.synthetic_' + synDuration + '.findOne(' +
                      inspect(query) + ', ...)');
                synCollection.findOne(query, tryUpdateMinMax);
              }
            });
          }
        );
      });
    });
  });

  // Execute all queued up operations 10 at a time, to avoid blocking for an
  // excessive amount of time talking to the DB.
  execInGroups(4, toExec, cb);
  // chain(toExec, cb);
}


function expandSample(sample, f) {
  if (_.isArray(sample.val)) {
    var beg = 0, end = 0; // Delta decoding ad-hoc for speed.
    for (var i = 0, len = sample.val.length; i < len; ++i) {
      beg += sample.beg[i];
      end += sample.end[i];
      f({ beg: beg, end: end, val: sample.val[i] });
    }
  } else {
    f(sample);
  }
}


SampleDb.prototype.fetchRealSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
  _.defaults(options, {
    beginTime: null, endTime: null,
    minDuration: 0,
  });
  var beginTime = options.beginTime, endTime = options.endTime;
  var minLevel = getLevel(options.minDuration);

  var samples = [];
  Step(
    // Get real samples in parallel.
    function() {
      var parallel = this.parallel;

      // Get overlapping real samples.
      bucketThresholds.forEach(function(level, levelIndex) {
        if (level >= minLevel) {
          var bucketSize = bucketSizes[levelIndex];
          var query = { veh: vehicleId, chn: channelName };
          if (beginTime != null || endTime != null) {
            query.buk = { };
            if (beginTime != null)
              query.buk.$gte = Math.floor(beginTime / bucketSize);
            if (endTime != null) {
              var endQueryTime = endTime;
              // Tricky: because buckets are only determined based on the
              // beginning of each sample, we need to expand our query range by
              // the maximum size of a sample at this level, which is the size
              // of the next level.  The exception is the top level.
              if (levelIndex < bucketThresholds.length - 1)
                endQueryTime += bucketThresholds[levelIndex + 1];
              query.buk.$lt = Math.ceil(endQueryTime / bucketSize);
            }
          }
          var cursor = self.sampleCollections[level].find(
            query, {  // Fields:
              _id: 0,  // No need for _id.
              beg: 1,
              end: 1,
              val: 1,
            }
          );
          var nextStep = parallel();
          cursor.nextObject(processNext);
          function processNext(err, rawSample) {
            if (err || !rawSample) {
              nextStep(err);
            } else {
              expandSample(rawSample, function(sample) {
                // Ignore samples which don't overlap our time range.
                if ((beginTime == null || beginTime < sample.end) &&
                    (endTime == null || sample.beg < endTime)) {
                  samples.push(sample);
                }
              });
              cursor.nextObject(processNext);
            }
          }
        }
      });
    },

    function(err) {
      if (err) { cb(err); return; }
      cb(err, samples);
    }
  );
}


SampleDb.prototype.fetchSyntheticSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
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
  if (beginTime != null) {
    query.buk = { $gte: Math.floor(beginTime / synDuration),
                  $lt: Math.ceil(endTime / synDuration) };
  }
  if (beginTime != null || endTime != null) {
    query.buk = { };
    if (beginTime != null)
      query.buk.$gte = Math.floor(beginTime / synDuration);
    if (endTime != null)
      query.buk.$lt = Math.ceil(endTime / synDuration);
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
  var cursor = self.syntheticCollections[synDuration].find(query, fields);
  cursor.nextObject(processNext);
  function processNext(err, sample) {
    if (err || !sample) {
      cb(err, samples);
    } else {
      samples.push(sample);
      cursor.nextObject(processNext);
    }
  }
}


SampleDb.prototype.fetchMergedSamples =
    function(vehicleId, channelName, options, cb) {
  var self = this;
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
      getSyntheticDuration(options.minDuration);
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

      // Compute synthetic averages by bucket.
      var synBegin = Math.floor(options.beginTime / synDuration);
      var synEnd = Math.ceil(options.endTime / synDuration);
      var synAverages = new Array(synEnd - synBegin);
      var synMin = getMinMax && new Array(synEnd - synBegin);
      var synMax = getMinMax && new Array(synEnd - synBegin);
      synSamples.forEach(function(s) {
        var i = s.buk - synBegin;
        if (s.ovr)
          synAverages[i] = s.sum / s.ovr;
        if (getMinMax) {
          synMin[i] = s.min;
          synMax[i] = s.max;
        }
      });

      // For each gap in real data, add synthetic data if available.
      sortSamplesByTime(realSamples);  // Make gap finding work.
      var gapSamples = [];
      // Use beginning and end of synthetic range, so that we don't chop up
      // synthetic samples at beginning & end.
      forSampleGaps(realSamples, synBegin * synDuration, synEnd * synDuration,
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
      this(null, realSamples);
    },

    cb
  );
}


//// Constants and utility functions: ////


// Time constants.
var us = SampleDb.us = 1;
var ms = SampleDb.ms = 1000 * us;
var s = SampleDb.s = 1000 * ms;
var m = SampleDb.m = 60 * s;
var h = SampleDb.h = 60 * m;
var d = SampleDb.d = 24 * h;

// The smallest duration which fits in each bucket, in us.
var bucketThresholds = SampleDb.bucketThresholds = [
  0 * us,
  500 * us,
  5 * ms,
  50 * ms,
  500 * ms,
  5 * s,
  30 * s,
  5 * m,
  30 * m,
  5 * h,
];

var syntheticDurations = SampleDb.syntheticDurations = [
  100 * us,
  1 * ms,
  10 * ms,
  100 * ms,
  1 * s,
  10 * s,
  1 * m,
  10 * m,
  1 * h,
  1 * d,
];

// The size of the buckets in each bucket level.
var bucketSizes = SampleDb.bucketSizes = bucketThresholds.map(function(t, i) {
  return (i > 0) ? t * 100 : 500 * us;  // Special case for first level.
});


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
var getLevelIndex = SampleDb.getLevelIndex = function(duration) {
  return lastMatch(bucketThresholds, function(minDuration) {
    return duration >= minDuration;
  });
};

var getLevel = SampleDb.getLevel = function(duration) {
  return bucketThresholds[getLevelIndex(duration)];
};

var getLevelInfo = SampleDb.getLevelInfo = function(beginTime, endTime) {
  var i = getLevelIndex(endTime - beginTime);
  var bucketSize = bucketSizes[i];
  return {
    level: bucketThresholds[i],
    levelIndex: i,
    bucketSize: bucketSize,
    minBucket: Math.floor(beginTime / bucketSize),
    maxBucket: Math.ceil(endTime / bucketSize) - 1,
  };
};


/**
 * Get the level for a given duration.
 */
var getSyntheticDuration = SampleDb.getSyntheticDuration = function(duration) {
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
var forSyntheticSamples = SampleDb.forSyntheticSamples =
    function(beginTime, endTime, cb) {
  var duration = endTime - beginTime;
  syntheticDurations.forEach(function(synDuration) {
    if (duration < synDuration) {
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


var forSampleGaps = SampleDb.forSampleGaps =
    function(samples, beginTime, endTime, cb) {
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


var toNumber = SampleDb.toNumber = function(n) {
  if ('number' === typeof n)
    return n;
  else
    return n.toNumber();
};


var sortSamplesByTime = SampleDb.sortSamplesByTime = function(samples) {
  samples.sort(function(a, b) {
    return toNumber(a.beg) - toNumber(b.beg);  // Compare times.
  });
};

/**
 * Generate samples at a new resolution.
 * @param startTime
 * @param options
 * @returns A new SampleSeries with the synthetic data.
 */
var resample = SampleDb.resample =
    function(inSamples, beginTime, endTime, sampleSize, options) {
  options = options || {};

  var sampleCount = Math.ceil((endTime - beginTime) / sampleSize);
  var result = new Array(sampleCount);

  function forEachSampleOverlap(cb) {
    inSamples.forEach(function(s) {
      var begin = Math.max(0, Math.floor((s.beg - beginTime) / sampleSize));
      var end = Math.min(sampleCount,
                         Math.ceil((s.end - beginTime) / sampleSize));
      for (var i = begin; i < end; ++i) {
        var sampleStart = beginTime + i * sampleSize;
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
        min: val,
        max: val,
      };
    } else {
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
  return _.reject(result, _.isUndefined);
};
