// Math functions on real samples coming from the database

var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var Samples = require('./samples');

var SampleMath = exports.SampleMath = function(sampleSet, samples, options) {
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

  _.defaults(options, {
    // sampleSize is defaulted to the smallest duration real sample
    sampleSize: _.min(dur),
    average: 10,
  });

  var resampled = this.samples.resample(sampleSet, begin, end, options.sampleSize);

  var averages = Math.min(options.average, resampled.length);
  var averaged = [];
  averaged[0] = {
    beg: resampled[averages-1].beg,
    end: resampled[averages-1].beg + options.sampleSize,
    val: 0
  };

  for (var i = 0; i < Math.min(options.average, resampled.length); i++) {
    averaged[0].val += resampled[i].val
  }

  for (var i = averages; i < resampled.length; i++) {
    var i0 = i - averages;
    var sample = {};
    sample.val = averaged[i0].val + resampled[i].val - resampled[i0].val;
    sample.beg = resampled[i].beg;
    sample.end = resampled[i].end;
    averaged.push(sample);
  }

  var inverseAverages = 1/averages;
  _.each(averaged, function(a) { a.val = a.val * inverseAverages; });
  return averaged;
}
