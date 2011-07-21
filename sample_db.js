// Functionality for saving samples to the DB.

var _ = require('underscore');
var util = require('util'), debug = util.debug;
var Step = require('step');


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


SampleDb.prototype.insertSample =
    function(vehicleId, channelName, beginTime, endTime, value) {
  var self = this;
  var levelInfo = getLevelInfo(beginTime, endTime);

  // Insert sample into DB.
  if (false) {
    debug('insertSample(' +
          toNumber(vehicleId) + ', ' +
          channelName + ', ' +
          toNumber(beginTime) + ', ' +
          toNumber(endTime) + ', ' +
          util.inspect(value) + ')');
    debug(util.inspect(levelInfo));
  }
  var buckets = levelInfo.minBucket == levelInfo.maxBucket ?
      levelInfo.minBucket :
      _.range(levelInfo.minBucket, levelInfo.maxBucket + 1);
  self.sampleCollections[levelInfo.level].insert(
    {
      veh: vehicleId,
      chn: channelName,
      buk: buckets,
      beg: beginTime,
      end: endTime,
      val: value,
    }
  );

  // HACK: underscore channels don't get synthetic versions.
  if (channelName[0] == '_')
    return;

  // Update synthetic samples.
  forSyntheticSamples(beginTime, endTime,
                      function(synBucket, synDuration, overlap) {
    self.syntheticCollections[synDuration].update(
      {  // Query:
        veh: vehicleId,
        chn: channelName,
        buk: synBucket,
      }, {  // Update:
        $inc: {
          sum: value * overlap,
          ovr: overlap,
        },
        // max? min?
        // Unfortunately, mongodb has no $min or $max operators.
      }, { // Options:
        upsert: true,  // Insert if not found
      });
  });
}


SampleDb.prototype.fetchRealSamples =
    function(vehicleId, channelName, beginTime, endTime, minDuration, cb) {
  var self = this;
  var minLevel = getLevel(minDuration);

  var samples = [];
  Step(
    // Get real samples in parallel.
    function() {
      var parallel = this.parallel;

      // Get overlapping real samples.
      bucketThresholds.forEach(function(level, levelIndex) {
        if (level >= minLevel) {
          var bucketSize = bucketSizes(levelIndex);
          var query = { veh: vehicleId, chn: channelName };
          if (!_.isUndefined(beginTime)) {
            query.buk = { $gte: Math.floor(beginTime / bucketSize),
                          $lt: Math.ceil(endTime / bucketSize) };
          }
          var cursor = self.sampleCollections[level].find(
            query , {  // Fields:
              _id: 0,  // No need for _id.
              beg: 1,
              end: 1,
              val: 1,
            }
          );
          var nextStep = parallel();
          cursor.nextObject(processNext);
          function processNext(err, sample) {
            if (err || !sample) {
              nextStep(err);
            } else {
              // Ignore samples which don't overlap our time range.
              if (_.isUndefined(beginTime) ||
                  (beginTime < sample.end && sample.beg < endTime))
                samples.push(sample);
              cursor.nextObject(processNext);
            }
          }
        }
      });
    },

    function(err) {
      if (err) { cb(err); return; }
      cb(err, samples);  // TODO: something better.
    }
  );
}


SampleDb.prototype.fetchSyntheticSamples =
    function(vehicleId, channelName, beginTime, endTime, synDuration, cb) {
  var self = this;

  // Get overlapping synthetic samples with appropriate duration.
  var samples = [];
  var query = { veh: vehicleId, chn: channelName };
  if (!_.isUndefined(beginTime)) {
    query.buk = { $gte: Math.floor(beginTime / synDuration),
                  $lt: Math.ceil(endTime / synDuration) };
  }
  var cursor = self.syntheticCollections[synDuration].find(
    query, {  // Fields:
      _id: 0,  // No need for _id.
      buk: 1,
      sum: 1,
      ovr: 1,
      // min, max
    }
  );
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
    function(vehicleId, channelName, beginTime, endTime, minDuration, cb) {
  var self = this;
  var synDuration = getSyntheticDuration(minDuration);

  Step(
    // Get real samples and synthetic samples in parallel.
    function() {
      // Note: we must get samples which are longer than synDuration, since
      // those are all samples which didn't contribute to the synthetic
      // samples.  However, in the case that minDuration is less than the
      // smallest synthetic duration, we should get samples above minDuration
      // too.
      var minFetchDuration = Math.min(synDuration, minDuration);
      self.fetchRealSamples(vehicleId, channelName, beginTime, endTime,
                            minFetchDuration, this.parallel());

      // Get overlapping synthetic samples with appropriate duration.
      self.fetchSyntheticSamples(vehicleId, channelName, beginTime, endTime,
                                 synDuration, this.parallel());
    },

    // Merge real and synthetic samples.
    function(err, realSamples, synSamples) {
      if (err) { cb(err); return; }

      // Compute synthetic averages by bucket.
      var synBegin = Math.floor(beginTime / synDuration);
      var synEnd = Math.ceil(endTime / synDuration);
      var synAverages = new Array(synEnd - synBegin);
      synSamples.forEach(function(s) {
        if (s.ovr)
          synAverages[s.buk - synBegin] = s.sum / s.ovr;
      });

      // For each gap in real data, add synthetic data if available.
      sortSamplesByTime(realSamples);  // Make gap finding work.
      var gapSamples = [];
      forSampleGaps(realSamples, beginTime, endTime,
                    function(gapBegin, gapEnd) {
        // NOTE: this gets very slow if we're querying over a large time range,
        // even if there's little synthetic data.  Fortunately, the web front
        // end should only request a reasonable number of samples.  If we
        // wanted to make this scale to a large number of buckets, we'd want
        // to do some kind of binary range search over synSamples.
        var bukBegin = Math.floor(gapBegin / synDuration);
        var bukEnd = Math.ceil(gapEnd / synDuration);
        for (var buk = bukBegin; buk < bukEnd; ++buk) {
          var avg = synAverages[buk - synBegin];
          if (!_.isUndefined(avg)) {
            var beg = buk * synDuration;
            gapSamples.push({
              beg: Math.max(gapBegin, beg),
              end: Math.min(gapEnd, beg + synDuration),
              val: avg,
            });
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
var bucketSizes = SampleDb.bucketSizes = function(i) {
  return bucketThresholds[i + 1] ||
      (10 * d);  // Special case for last level.
};


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
  var bucketSize = bucketSizes(i);
  return {
    level: bucketThresholds[i],
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
  var options = options || {};
  var i, n;

  var sampleCount = Math.ceil((endTime - beginTime) / sampleSize);
  var result = new Array(sampleCount);

  function forEachSampleOverlap(cb) {
    inSamples.forEach(function(s) {
      var begin = Math.max(0, Math.floor((s.beg - beginTime) / sampleSize));
      var end = Math.min(sampleCount,
                         Math.ceil((s.end - beginTime) / sampleSize));
      for (n = begin; n < end; ++n) {
        var sampleStart = beginTime + n * sampleSize;
        var sampleEnd = sampleStart + sampleSize;
        var overlap =
            Math.min(sampleEnd, s.end) - Math.max(sampleStart, s.beg);
        cb(n, s, overlap, sampleStart, sampleEnd);
      }
    });
  }

  // Compute sums and overlaps.
  forEachSampleOverlap(function(n, s, weight, sampleStart, sampleEnd) {
    var r = result[n];
    if (!r) {
      r = result[n] = {
        beg: sampleStart,
        end: sampleEnd,
        sum: 0,
        ovr: 0,
      };
    }
    r.sum += s.val * weight;
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
