/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var csv = require('csv');
var util = require('util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var printSamples = require('../util/print_samples.js').printSamples;
var SampleDb = require('../sample_db.js').SampleDb;

// Handle Execution of fetch sample queues.
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

  // RPC handling
  this.socket.on('rpc', _.bind(function () {

    // Parse arguments.
    var args = Array.prototype.slice.call(arguments);
    var handle = args.pop();
    var fn = this[args.shift()];
    if (!fn) return this.socket.emit(handle, 'Invalid method call');

    // Setup callback.
    var cb = _.bind(function (err, data) {
      this.socket.emit(handle, err, data);
    }, this);
    args.push(cb);
    
    // Finally, call the method.
    fn.apply(this, args);
  }, this));

  // Handles currently being delivered to client (vehicleId, channelName).
  this.subscriptions = {};

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);
}

/*
 * Fetch samples.
 * TODO: get rid of subscriptions, 
 * replace with 'wait until data available' option.
 */
Client.prototype.fetchSamples =
    function (did, channelName, options, cb) {

  util.debug(color.bgBlackBright.white.bold('fetchSamples:'));
  util.debug(color.blackBright('  datasetId   = ')
      + color.green.bold(did));
  util.debug(color.blackBright('  channelName = ')
      + color.cyan.bold(channelName));
  if (options.beginTime)
    util.debug(color.blackBright('  beginTime   = ')
        + color.yellow.bold(options.beginTime));
  if (options.endTime)
    util.debug(color.blackBright('  endTime   = ')
        + color.yellow.bold(options.endTime));
  if (options.minDuration)
    util.debug(color.blackBright('  minDuration = ')
        + color.blue.bold(options.minDuration));
  if (options.getMinMax)
    util.debug(color.blackBright('  getMinMax   = ')
        + color.magenta.bold(options.getMinMax));

  // Handle fetching with queues.
  this.sampleDbExecutionQueue(_.bind(function (done) {
    function next(err, samples) {
      cb(err, samples);
      done();
    };
    this.sampleDb.fetchSamples(did, channelName, options, next);
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
Client.prototype.insertCSVSamples = function (file, cb) {
  var self = this;
  var buffer = new Buffer(file.base64, 'base64');
  var opts = {
    ignore: ['date', 'time', 'timestamp', 'datetime', 'year', 'month',
        'day', 'hour', 'minute', 'second'],
    maxdur: 100000,
    addChannel: null
  };
  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;
  var timecol;
  var sampleSet = {};
  var channels = [];
  var did;

  Step(

    // Read csv file.
    function () {
      var prevEnd = -Number.MAX_VALUE;
      csv().from.string(buffer.toString(),
          {columns: true}).to.array(_.bind(function (rows, nn) {
        if (!rows || rows.length === 0) this('Invalid dataset');

        var tmp = {};
        _.each(rows[0], function (value, key) {
          tmp[key.toLowerCase().trim()] = key;
        });
        if (tmp.datetime) timecol = tmp.datetime;
        else if (tmp.date) timecol = tmp.date;
        else if (tmp.time) timecol = tmp.time;
        if (!timecol)
          return this('Could not find time, data, or datetime column');

        // Group row data into channels.
        _.each(rows, _.bind(function (row, index) {
          var line = index + 1;
          var date = new Date(row[timecol]);
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
            if (!_.contains(opts.ignore, key.toLowerCase().trim())
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
              } else console.log(value);
            }
          });
        }, this));
        this();
      }, this));
    },

    // Write samples.
    function (err) {
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
      _.each(sampleSet, SampleDb.mergeOverlappingSamples);

      // Add dummy schema samples.
      var schema = sampleSet['_schema'] = [];
      _.each(columns, function (channelName) {
        var samples = sampleSet[channelName];
        if (!samples) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var tmp = (m ? m[1]: channelName).toLowerCase();
        var cn = _.slugify(_.prune(tmp, 40, '')).replace(/-/g, '_');
        var v = {
          beg: _.first(samples).beg,
          end: _.last(samples).end,
          val: {
            channelName: cn,
            type: 'float',
            merge: true,
          },
        };
        if (m) v.val.units = m[2].replace('_', '/');
        schema.push(v);
        sampleSet[cn] = samples;
        delete sampleSet[channelName];
        channels.push(cn);
      });

      // Samples are ready.
      this();
    },

    function (err) {
      if (err) return this(err);

      // Create a dataset container for the samples.
      // TODO: change from vehicle specific terms,
      // let new sample be added to existing datasets.
      self.userDb.createVehicle({title: file.name},
          _.bind(function (err, veh) {
        if (err) return this(err);
        did = veh._id;
        self.sampleDb.insertSamples(veh._id, sampleSet, this);
      }, this));
    },

    function (err) {
      if (err) {
        util.error(err);
        cb(err);
        return;
      }

      util.debug(color.bgBlackBright.white.bold('insertCSVSamples:'));
      util.debug(color.blackBright('  file name = ')
          + color.red.bold(file.name));
      util.debug(color.blackBright('  file size = ')
          + color.red.bold(file.size));
      util.debug(color.blackBright('  file rows = ')
          + color.red.bold(num));
      util.debug(color.blackBright('  datasetId = ')
          + color.green.bold(did));
      util.debug(color.blackBright('  beginTime = ')
          + color.yellow.bold(firstBeg));
      util.debug(color.blackBright('  endTime   = ')
          + color.yellow.bold(lastEnd));
      util.debug(color.blackBright('  channels  = '));
      _.each(channels, function (channel) {
        util.debug(color.cyan.bold('    ' + channel));
      });

      // Complete.
      cb(null, {did: did, channels: channels, beg: firstBeg, end: lastEnd});
    }
  );

}
