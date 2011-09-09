/*!
 * Copyright 2011 Mission Motors
 */

/**
 * Merge samples which are adjacent or overlapping and share a value.
 * WARNING: this function is duplicated in sample_db.js and service.js - be sure
 * to keep both versions up to date.
 * TODO: figure out how to actually share code.
 *
 * @param samples Set of incoming samples, sorted by begin time.
 */
var mergeOverlappingSamples =
exports.mergeOverlappingSamples = function (samples) {
  // Index of first sample which might overlap current sample.
  var mightOverlap = 0;

  for (var i = 0; i < samples.length; ++i) {
    var s = samples[i];
    // Skip ahead until mightOverlap is a sample which could possibly overlap.
    while (samples[mightOverlap].end < s.beg)
      ++mightOverlap;
    for (var j = mightOverlap; j < i; ++j) {
      var t = samples[j];
      if (/*t.end >= s.beg &&*/ t.beg <= s.end &&
          t.val == s.val && t.min == s.min && t.max == s.max) {
        // Samples overlap - merge them.
        t.beg = Math.min(t.beg, s.beg);
        t.end = Math.max(t.end, s.end);
        samples.splice(i, 1);  // Delete sample i.
        --i;
        break;
      }
    }
  }
}

