var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

exports.printSamples = function(sampleSet, log, cb) {
  if (!cb) {
    cb = log;
    log = console.log;
  }
  log('{');
  var work = [];
  if (sampleSet['_schema']) {
    debug('_schema');
    log('  _schema: [');
    sampleSet['_schema'].forEach(function(s) {
      log('    { beg: ' + s.beg + ', end: ' + s.end + ', val:');
      log(indent('        ', insp(s.val) + ' },'));
    });
    log('  ],');
  }
  _.forEach(sampleSet, function(samples, channelName) {
    work.push(function(next) {
      if (channelName != '_schema') {
        debug('writing ' + channelName);
        log('  \'' + channelName + '\': [');
        samples.forEach(function(s) {
          log('    { beg: ' + s.beg + ', end: ' + s.end +
              ', val: ' + insp(s.val) + ' },');
        });
        log('  ],');
      }
      next();
    });
  });
  work.push(function(next) {
    log('}');
    next();
  });
  doWork(work, cb);
};

function indent(prefix, str) { return str.replace(/^/mg, prefix); }
function insp(obj) { return inspect(obj, false, null); }
function doWork(work, next) {
  (function f() {
    if (!work.length) {
      next();
    } else {
      if (process.stdout.busy)
        process.stdout.once('drain', (work.shift()).bind(this, f));
      else
        (work.shift())(f);
    }
  })();
}
