/*!
 * Copyright 2011 Mission Motors
 *
 * This code is loaded both in the web app and in the server.
 */

var _ = require('underscore');
_.mixin({ stableSort: stableSort });


//// Constants and utility functions: ////


// Time constants.
var us = exports.us = 1;
var ms = exports.ms = 1000 * us;
var s = exports.s = 1000 * ms;
var m = exports.m = 60 * s;
var h = exports.h = 60 * m;
var d = exports.d = 24 * h;

// The smallest duration which fits in each bucket, in us.
exports.bucketThresholds = [
  0 * us,
  500 * us,
  5 * ms,
  50 * ms,
  500 * ms,
  5 * s,
  30 * s,
  5 * m,
  30 * m,
  5 * h,  // TODO: make this 6 hours!  Think about DB changes...
];

exports.syntheticDurations = [
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

// Number of synthetic buckets per db row.
exports.syntheticSamplesPerRow = 50;

// The size of the buckets in each bucket level.
exports.bucketSizes = exports.bucketThresholds.map(function(t, i) {
  return (i > 0) ? t * 100 : 500 * us;  // Special case for first level.
});


/**
 * Compare two sample values.
 */
var sampleValuesEqual = exports.sampleValuesEqual = function(val1, val2) {
  // Underscore's isEqual function is too paranoid about comparing objects
  // created with different constructor functions but identical contents.
  if (_.isArray(val1) && _.isArray(val2)) {
    return val1.length === val2.length &&
        _.all(val1, function(v1, i) { return sampleValuesEqual(v1, val2[i]) });
  } else if (_.isObject(val1) && _.isObject(val2)) {
    return sampleValuesEqual(_.keys(val1), _.keys(val2)) &&
        _.all(val1, function(v1, i) { return sampleValuesEqual(v1, val2[i]) });
  } else
    return val1 === val2;
}


/**
 * Determine whether two samples can be merged, and return a merged version if
 * they can.
 */
exports.tryMergeSamples = function(s, t, channelName, expandBy) {
  var merged = null;
  function simpleMerge() {
    merged = {
      beg: Math.min(s.beg, t.beg),
      end: Math.max(s.end, t.end),
      val: s.val,
    };
    if (s.min != null) merged.min = s.min;
    if (s.max != null) merged.max = s.max;
  }
  expandBy = expandBy || 0;
  if (t.end + expandBy >= s.beg && t.beg - expandBy <= s.end &&
      t.min == s.min && t.max == s.max) {
    if (channelName === '_schema' &&
        s.val.sampleDuration && t.val.sampleDuration) {
      // Compare values, excluding sampleDuration and sampleCount:
      var valsEqual = sampleValuesEqual(_.keys(s.val), _.keys(t.val)) &&
        _.all(s.val, function(v1, i) {
          return i === 'sampleCount' || i === 'sampleDuration' ||
              sampleValuesEqual(v1, t.val[i]);
        });
      if (valsEqual) {
        var sDensity = s.val.sampleCount / s.val.sampleDuration;
        var tDensity = t.val.sampleCount / t.val.sampleDuration;
        // Allow merging if densities are within 50%.
        if (tDensity <= sDensity * 1.5 && sDensity <= tDensity * 1.5) {
          simpleMerge();
          merged.val = _.clone(s.val);
          merged.val.sampleCount += t.val.sampleCount;
          merged.val.sampleDuration += t.val.sampleDuration;
        }
      }
    } else if (exports.sampleValuesEqual(t.val, s.val)) {
      simpleMerge();
    }
  }
  //console.log('???', channelName, 's:', s, 't:', t, 'merged:', merged);
  return merged;
}


/**
 * Merge samples which are adjacent or overlapping and share a value.
 *
 * @param samples Set of incoming samples, sorted by begin time.
 */
exports.mergeOverlappingSamples = function(samples, channelName) {
  // Index of first sample which might overlap current sample.
  var mightOverlap = 0;

  for (var i = 0; i < samples.length; ++i) {
    var s = samples[i];
    // Skip ahead until mightOverlap is a sample which could possibly overlap.
    while (samples[mightOverlap].end < s.beg)
      ++mightOverlap;
    for (var j = mightOverlap; j < i; ++j) {
      var t = samples[j];
      var merged = exports.tryMergeSamples(s, t, channelName);
      if (!merged) continue;
      // Samples overlap - merge them.
      samples[j] = merged;
      samples.splice(i, 1);  // Delete sample i.
      --i;
      break;
    }
  }
}


/**
 * Reorganize a sampleSet into a list of samples which occur with the same
 * begin and end times.
 *
 * @param sampleSet Mapping from channel name to sample arrays.  Sample arrays
 *     must be sorted by time.
 * @return Array of maps from channel name to samples.
 */
exports.splitSamplesByTime = function(sampleSet) {
  var channels = Object.keys(sampleSet);
  var cur = {};
  channels.forEach(function(channelName) { cur[channelName] = 0; });
  var now = -Number.MAX_VALUE;
  var result = [];
  while (true) {
    // Skip any empty space.
    var firstBeg = null;  // Lowest begin time of current samples.
    channels.forEach(function(channelName) {
      var s = sampleSet[channelName][cur[channelName]];
      if (s && (firstBeg == null || s.beg < firstBeg))
        firstBeg = s.beg;
    });
    if (firstBeg == null)
      break;
    if (firstBeg > now)
      now = firstBeg;

    // Find next edge.
    var nextEdge = null;  // First begin or end after now, of current samples.
    channels.forEach(function(channelName) {
      var s = sampleSet[channelName][cur[channelName]];
      if (!s) return;
      if (s.beg > now && (nextEdge == null || s.beg < nextEdge))
        nextEdge = s.beg;
      if (s.end > now && (nextEdge == null || s.end < nextEdge))
        nextEdge = s.end;
      // Special case for zero-duration samples.
      if (s.end <= s.beg && s.beg == now)
        nextEdge = now;
    });

    // Move samples with same time into result.
    var newSample = { beg: now, end: nextEdge, val: {} };
    channels.forEach(function(channelName) {
      var s = sampleSet[channelName][cur[channelName]];
      if (s && s.beg <= now) {
        newSample.val[channelName] = s;
        if (s.end <= nextEdge)
          ++cur[channelName];
      }
    });
    result.push(newSample);
    now = nextEdge;
  }
  return result;
}


/**
 * Trim a sample list to fit entirely within a given time range.
 * @param samples The sample list to trim.  Must be sorted, and non-overlapping.
 * @param beg,end Time range to trim to.
 * @return The subset of the samples which fit between beg and end, with
 *    samples which overlap beg/end trimmed to length.
 */
exports.trimSamples = function(samples, beg, end) {
  var len = samples.length;
  for (var first = 0; first < len; ++first)
    if (samples[first].end > beg || samples[first].beg == beg) break;
  for (var last = len - 1; last >= first; --last)
    if (samples[last].beg < end || samples[last].end == end) break;
  var r = samples.slice(first, last + 1);
  var first = r[0];
  if (first && first.beg < beg) {
    first = r[0] = _.clone(first);
    first.beg = beg;
  }
  var last = _.last(r);
  if (last && last.end > end) {
    last = r[r.length - 1] = _.clone(last);
    last.end = end;
  }
  return r;
}


// Array.prototype.sort() is not stable on V8 (elements which compare the same
// can have their order changed by sort).  This is a stable merge sort.
function stableSort(array, compare) {
  function merge(a1, a2) {
    var l1 = a1.length, l2 = a2.length, l = l1 + l2, r = new Array(l);
    for (var i1 = 0, i2 = 0, i = 0; i < l;) {
      if (i1 === l1)
        r[i++] = a2[i2++];
      else if (i2 === l2 || compare(a1[i1], a2[i2]) <= 0)
        r[i++] = a1[i1++];
      else
        r[i++] = a2[i2++];
    }
    return r;
  }
  function sort(a) {
    var l = a.length, m = Math.ceil(l / 2);
    return (l <= 1) ? a : merge(sort(a.slice(0, m)), sort(a.slice(m)));
  }
  return sort(array);
}
exports.stableSort = stableSort;
