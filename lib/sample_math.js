// Math functions on real samples coming from the database

var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var Samples = require('./samples');

var SampleMath = exports.SampleMath = function(sampleSet, samples, options) {
  _.defaults(options, {
    // sampleSize is defaulted to the smallest duration real sample
    type: 'simpleMovingAverage',
    metric: 10,
  });


  var self = this;
  this.samples = samples;
  if (!sampleSet || !sampleSet[0]) return [];
  switch (options.type) {
    case 'simpleMovingAverage':
      return self.movingAverage(sampleSet, options);
      break;
    default:
      return null;
      break;
  }
};

/*
SampleMath.prototype.work = function(sampleSet, options) {
  switch (options.mathFunction) {
    case 'simpleMovingAverage':
      return self.movingAverage(sampleSet, options, cb);
      break;
    default:
      return null;
      break;
  }
}
*/

SampleMath.prototype.movingAverage = function(sampleSet, options) {

  if (options == null) {
    options = {};
  }

  var begin = sampleSet[0].beg;
  var end = _.last(sampleSet).end;

  var dur = _.map(sampleSet, function(s) { return s.end - s.beg; });

  // removes the last duration from the sample set, which may be bogus
  dur.pop();

  var resampled = this.samples.resample(sampleSet, begin, end, options.duration);
  var samplesOnly = _.pluck(resampled, 'val')

  var averages = Math.min(options.metric, samplesOnly.length);
  var averaged = [];
  averaged[0] = 0;

  for (var i = 0; i < averages; i++) {
    averaged[0] += samplesOnly[i];
  }

  for (var i = averages; i < samplesOnly.length; i++) {
    var i0 = i - averages;
    var sample = [];
    sample = averaged[i0] + samplesOnly[i] - samplesOnly[i0];
    averaged.push(sample);
  }

  var inverseAverages = 1/averages;
  averaged = _.map(averaged, function(a) { return a * inverseAverages; });
  return {
    vals: averaged,
    beg: sampleSet[averages].beg,
    dur: options.duration,
  }
}
