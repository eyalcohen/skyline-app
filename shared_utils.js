/*!
 * Copyright 2011 Mission Motors
 *
 * This code is loaded both in the web app and in the server.
 */


// Requirements:


/**
 * Merge samples which are adjacent or overlapping and share a value.
 *
 * @param samples Set of incoming samples, sorted by begin time.
 */
exports.mergeOverlappingSamples = function(samples) {
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
