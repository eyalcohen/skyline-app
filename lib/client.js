/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var cluster = require('cluster');
var csv = require('csv');
var util = require('util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var printSamples = require('../util/print_samples.js').printSamples;
var db = require('./db');
var com = require('./common.js');
var profiles = require('./resources').profiles;
var Samples = require('./samples');

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

// Constructor
var Client = exports.Client = function (socket, samples) {
  this.socket = socket;
  this.samples = samples;

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

  // Handles currently being delivered to client (datasetId, channelName).
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

  util.debug(color.bgBlackBright.white.bold('Worker '
    + cluster.worker.id + ': fetchSamples:'));
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
    this.samples.fetchSamples(did, channelName, options, next);
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
Client.prototype.insertCSVSamples = function (data, cb) {
  var self = this;
  var buffer = new Buffer(data.base64, 'base64');
  var opts = {
    ignore: ['date', 'time', 'timestamp', 'datetime', 'year', 'month',
        'day', 'hour', 'minute', 'second'],
    addChannel: null
  };
  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;
  var timecol;
  var sampleSet = {};
  var channels = [];
  var dataset;
  var did = com.createId_32();

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
        var valid = true;
        _.each(rows, _.bind(function (row, index) {
          if (!valid) return;
          var line = index + 1;
          var date = new Date(row[timecol]);
          var end = date.valueOf() * 1e3;
          var dur = index === 0 ? 1: end - prevEnd;
          if (dur <= 0) {
            valid = false;
            return util.debug('Line ' + line + ': time went backward');
          }
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
              }
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
      _.each(sampleSet, Samples.mergeOverlappingSamples);

      // Add dummy schema samples.
      var schema = sampleSet['_schema'] = [];
      _.each(columns, function (channelName) {
        var samples = sampleSet[channelName];
        if (!samples) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var tmp = (m ? m[1]: channelName).toLowerCase();
        var cn = _.slugify(_.prune(tmp, 40, '')).replace(/-/g, '_')
            + '__' + did;
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

      // Setup new dataset object.
      var props = {
        _id: did,
        title: data.title,
        file: data.file,
        meta: {
          beg: firstBeg,
          end: lastEnd,
          channel_cnt: channels.length,
        },
        author_id: new db.oid(self.socket.handshake.user._id),
        client_id: com.createId_32(),
      };

      // Create dataset... or don't.
      if (channels.length === 0) return this();
      db.Datasets.create(props, {force: {_id: 1, client_id: 1},
          inflate: {author: profiles.user}}, _.bind(function (err, doc) {
        if (err) return this(err);
        dataset = doc;
        self.samples.insertSamples(dataset._id, sampleSet, this);
      }, this));
    },

    function (err) {
      if (err) {
        util.error(err);
        cb(err);
        return;
      }

      // Log to console.
      util.debug(color.bgBlackBright.white.bold('Worker '
          + cluster.worker.id + ': insertCSVSamples:'));
      util.debug(color.blackBright('  file name = ')
          + color.red.bold(data.title));
      util.debug(color.blackBright('  file size = ')
          + color.red.bold(data.file.size));
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
      cb(null, com.client(dataset || {created: false}));

      // Broadcast to all clients.
      self.socket.broadcast.emit('dataset.new', com.client(dataset));
    }
  );

}
