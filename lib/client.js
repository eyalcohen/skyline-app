/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var Delivery  = require('delivery');
var csv = require('csv');
var util = require('util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var printSamples = require('../util/print_samples.js').printSamples;
var SampleDb = require('../sample_db.js').SampleDb;

// Handle 
function ExecutionQueue(maxInFlight) {
  var inFlight = 0;
  var queue = [];
  function done() {
    --inFlight;
    while (queue.length && inFlight < maxInFlight) {
      var f = queue.shift();
      ++inFlight;
      f(done);
    }
  }
  return function (f) {
    if (inFlight < maxInFlight) {
      ++inFlight;
      f(done);
    } else
      queue.push(f);
  };
}

var Client = exports.Client = function (socket, userDb, sampleDb) {
  this.socket = socket;
  this.userDb = userDb;
  this.sampleDb = sampleDb;

  // Handles currently being delivered to client (vehicleId, channelName).
  this.subscriptions = {};

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);

  // File transfers
  this.delivery = Delivery.listen(socket);
  this.delivery.on('receive.success', this.insertSamplesFromFile);
}

/*
 * Fetch samples.
 * TODO: get rid of subscriptions, 
 * replace with 'wait until data available' option.
 */
Client.prototype.fetchSamples = function (vehicleId, channelName, options, cb) {
  if (!UserDb.haveAccess(vehicleId, req.user.data.vehicles))
    return cb('Permission denied.');
  this.sampleDbExecutionQueue(_.bind(function (done) {
    var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
    function next(err, samples) {
      cb(err, samples);
      // TODO: subscriptions broken with execution queue.
      done();
    };
    if (options.subscribe != null) {
      var handle = options.subscribe;
      options.subscribe = 0.25;  // Polling interval, seconds.
      this.cancelSubscribeSamples(handle);
      this.subscriptions[handle] =
          this.sampleDb.fetchSamples(vehicleId, channelName, options, next);
    } else {
      this.sampleDb.fetchSamples(vehicleId, channelName, options, next);
    }
  }, this));
}

/*
 * Insert samples.
 *
 *   sampleSet = {
 *     <channelName>: [ samples ],
 *     ...
 *   }
 */
// Client.prototype.insertSamples = function (vehicleId, sampleSet, options, cb) {
//   if (_.isFunction(options) && cb == null) {
//     cb = options;
//     options = {};
//   }
//   sampleDb.insertSamples(vehicleId, sampleSet, options, cb);
// }

Client.prototype.insertSamplesFromFile = function (file) {
  var opts = {
    ignore: ['seconds', 'date', 'time', 'date_time'],
    maxdur: 10000,
    addChannel: null
  };
  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;

  Step(

    // Read csv file.
    function () {
      var sampleSet = {};
      var prevEnd = -Number.MAX_VALUE;
      csv().from.string(file.buffer.toString(),
          {columns: true}).to.array(_.bind(function (rows) {
        _.each(rows, function (row, index) {
          var line = index + 1;
          var date = new Date(row.date_time);
          var end = date.valueOf() * 1e3;
          var dur = end - prevEnd;
          if (dur > opts.maxdur * 1e6) {
            if (index > 0)
              util.debug('Line ' + line + ': duration ' + (dur / 1e6)
                  + ' > maxdur ' + opts.maxdur);
            dur = opts.maxdur * 1e6;
          }
          if (dur <= 0)
            return util.debug('Line ' + line + ': time went backward');
          var beg = end - dur;
          firstBeg = Math.min(firstBeg, beg);
          lastEnd = Math.max(lastEnd, end);
          prevEnd = end;
          _.each(row, function (value, key) {
            if (!_.contains(opts.ignore, key.toLowerCase())
                && value !== null && value !== '') {
              if (!sampleSet[key]) sampleSet[key] = [];

              // Strip anything after a colon.
              value = value.match(/^([^:]*)/)[1];

              // Ignore blanks and NaNs.
              if (value.match(/^(NaN|)$/i)) return;

              // Save to set key.
              var val = Number(value);
              if (!isNaN(val)) {
                ++num;
                sampleSet[key].push({beg: beg, end: end, val: val});
              }
            }
          });
        });
        this(null, sampleSet);
      }, this));
    },

    // Write samples.
    function (err, sampleSet) {
      if (err) return this(err);
      var columns = _.keys(sampleSet);

      // Add channels.
      if (!_.isArray(opts.addChannel))
        opts.addChannel = opts.addChannel ? [opts.addChannel] : [];
      _.each(opts.addChannel, function (chan) {
        var m = chan.match(/^(.+) *= *([^=]+)$/);
        util.error("Can't parse --addChannel '" + chan + "'");
        var val = eval('(' + m[2] + ')');
        sampleSet[m[1]] = [{beg: firstBeg, end: lastEnd, val: val}];
      });

      // Merge samples.
      util.debug('Merging samples.');
      _.each(sampleSet, SampleDb.mergeOverlappingSamples);

      // Add dummy schema samples.
      var schema = sampleSet['_schema'] = [];
      var order = 1;
      _.each(columns, function (channelName) {
        var samples = sampleSet[channelName];
        if (!samples) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var v = {
          beg: _.first(samples).beg,
          end: _.last(samples).end,
          val: {
            channelName: channelName,
            humanName: m ? m[1]: channelName,
            type: 'float',
            merge: true,
            order: order++,
          },
        };
        if (m) v.val.units = m[2].replace('_', '/');
        console.log(v)
        schema.push(v);
      });

      // Print samples to console.
      printSamples(sampleSet, this);
    },

    function (err) {
      if (err) util.error(err);
      util.log('Added ' + color.cyan(num) + ' samples from file')
    }
  );

}

/*
 * Stop receiving subscription data.
 */
Client.prototype.cancelSubscribeSamples = function (handle, cb) {
  
  // No need to check auth.
  if (handle != null && subscriptions[handle]) {
    sampleDb.cancelSubscription(subscriptions[handle]);
    delete subscriptions[handle];
  }
  if (cb) cb();
}
