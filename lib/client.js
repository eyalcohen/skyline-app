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
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;
var Samples = require('./samples');
var XLS = require('./xls_mod')

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
var Client = exports.Client = function (socket, pubsub, samples, reds) {
  this.socket = socket;
  this.pubsub = pubsub;
  this.samples = samples;
  this.search = reds.createSearch('datasets');

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
Client.prototype.fetchSamples = function (did, channelName, options, cb) {

  // Handle fetching with queues.
  this.sampleDbExecutionQueue(_.bind(function (done) {
    function next(err, samples) {

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
        util.debug(color.blackBright('  endTime     = ')
            + color.yellow.bold(options.endTime));
      if (options.minDuration)
        util.debug(color.blackBright('  minDuration = ')
            + color.blue.bold(options.minDuration));
      if (options.getMinMax)
        util.debug(color.blackBright('  getMinMax   = ')
            + color.magenta.bold(options.getMinMax));
      util.debug(color.blackBright('  sampleCount = ')
        + color.red.bold(samples.length));

      cb(err, {
        samples: samples,
        range: {
          beg: options.beginTime !== undefined ?
              options.beginTime: _.first(samples).beg,
          end: options.endTime !== undefined ?
              options.endTime: _.last(samples).end
        }
      });
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
Client.prototype.insertSamples = function (data, cb) {
  var self = this;
  var buffer = new Buffer(data.base64, 'base64');
  var demo = data.user === 'demo';
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

  // typical format is an array of rows followed by a count
  function parseCSV(cb) {
    csv().from.string(buffer.toString(),{columns: true})
      .to.array(function(rows, nn) {
        cb(null, rows, nn)
    });
  }

  function parseXls(cb) {
    var cfb = XLS.CFB.read(buffer.toString('base64'), {type: 'base64'});
    var wb = XLS.parse_xlscfb(cfb);
    // lazy - turn .xls into .csv and parse, also only look at the first sheet
    var convertCSV = XLS.utils.make_csv(wb.Sheets[wb.SheetNames[0]])
    csv().from.string(convertCSV, {columns: true})
      .to.array(function(rows, nn) {
        cb(null, rows, nn)
    });
  }

  // row is an object with a map of header:val pairs
  // We try to do some intelligent guessing of which column is the the time-series
  // basis.  We do this by applying some rules (first column is most lkely,
  // columns with key words etc).
  // Finally, we try to give some hints on how to parse the column based
  // on the name of the header
  function parseTimecol(row) {
    // fuzzy match on which column is the most likely to be date/time
    var headerScore = {};

    var result = {
      column: '',
      parseAsNum: false,
      dateHint: '',
    };

    _.each(row, function (value, key) {
      headerScore[key] = 0;
    });

    // first column gets a bonus point
    var firstcol = _.map(headerScore, function(val, key) { return key; })[0];
    ++headerScore[firstcol];

    // check each header for 'contains' on some string.  2 points!
    var commonDateTimeStrings = ['date', 'time', 'timestamp', 'datetime', 'year',
                             'month','day', 'hour', 'minute', 'second'];
    _.each(headerScore, function(val, key) {
      var match = _.find(commonDateTimeStrings, function(str) {
        return key.toLowerCase().trim().indexOf(str) != -1;
      })
      if (match) headerScore[key] += 2;
    })

    // parse strings that are all numbers as Number, otherwise as Date
    _.each(row, function(val, key) {
      // isFinite checks for a valid date object.  Check if val is a number
      if (isFinite(new Date(isNaN(val) ? val : +val)))
        headerScore[key] += 1;
      else
        headerScore[key] = Number.MIN_VALUE;
    })

    // tally results
    var bestGuess = _.reduce(headerScore, function (memo, val, key) {
      return (val > headerScore[memo] ? key : memo);
    }, firstcol);

    result.column = (headerScore[bestGuess] > 0) ? bestGuess : '';
    result.parseAsNum = !isNaN(row[result.column]);

    var header = bestGuess.toLowerCase().trim();
    if (header.indexOf('year') != -1) {
      result.dateHint = 'year';
    } else if (header.indexOf('month') != -1) {
      result.dateHint = 'month'
    } else if (header.indexOf('day') != -1) {
      result.dateHint = 'day'
    } else if (header.indexOf('hour') != -1) {
      result.dateHint = 'hour'
    } else if (header.indexOf('minute') != -1) {
      result.dateHint = 'minute'
    } else if (header.indexOf('second') != -1) {
      result.dateHint = 'second'
    }

    return result;
  }

  Step(

    // select our parsing mechanism based on file extension
    function () {
      if (data.file.ext === 'csv') {
        parseCSV(this)
      } else if (data.file.ext === 'xls') {
        parseXls(this)
      } else {
        return this('Unsupported data type')
      }
    },
    // Parse data object
    function (err, rows, nn) {
      if (err) return this(err)
      var prevEnd = -Number.MAX_VALUE;
      if (!rows || rows.length === 0) this('Invalid dataset');
      var tmp = {};
      _.each(rows[0], function (value, key) {
        tmp[key.toLowerCase().trim()] = key;
      });

      var timecolGuess = parseTimecol(rows[0]);
      if (timecolGuess.column === '')
        return this('Could not find time, date, or datetime column');
      else
        timecol = timecolGuess.column;

      // Test if time is going backwards. If so, hey, lets try to reverse.
      // If its STILL wrong, this probably isn't going to work.
      var checkIncreasingDate = function() {
        // find instances of time going backwards.  find() stops when true
        var badmatch = _.find(rows, function(row) {
          var date = new Date(timecolGuess.parseAsNum
                              ? +(row[timecol])
                              : row[timecol]);
          var end = date.valueOf() * 1e3;
          var dur = end - prevEnd;
          if (dur < 0) {
            return date
          }
          prevEnd = end;
        })
        return badmatch === undefined;
      }

      if (!checkIncreasingDate()) {
        rows = rows.reverse();
        prevEnd = -Number.MAX_VALUE;
        if (!checkIncreasingDate())
          return this('Time is not always increasing or decreasing.');
      }

      var index = 0;
      _.each(rows, _.bind(function (row) {
        var end = new Date(0);
        if (timecolGuess.dateHint === 'year')
          end = end.setUTCFullYear(row[timecol]).valueOf();
        else if (timecolGuess.dateHint === 'month')
          end = end.setMonth(row[timecol]).valueOf();
        else if (timecolGuess.dateHint === 'day')
          end = end.setDay(row[timecol]).valueOf();
        else if (timecolGuess.dateHint === 'hour')
          end = end.setHour(row[timecol]).valueOf();
        else if (timecolGuess.dateHint === 'minute')
          end = end.setMinute(row[timecol]).valueOf();
        else if (timecolGuess.parseAsNum)
          end = row[timecol];
        else
          end = new Date(row[timecol]).valueOf();
        if (isNaN(end)) return;
        end = end * 1e3;
        var dur = index === 0 ? 1: end - prevEnd;
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

            // Remove commas.
            value = value.replace(',', '');

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
        ++index;
      }, this));
      this();
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
        if (!samples || samples.length === 0) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var tmp = (m ? m[1]: channelName).toLowerCase();
        var cn = _.slugify(_.prune(tmp, 40, '')).replace(/-/g, '_')
            + '__' + did;
        var v = {
          beg: _.first(samples).beg,
          end: _.last(samples).end,
          val: {
            channelName: cn,
            humanName: tmp,
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
      var next = this;

      Step(
        function () {

          // Ensure user id is object id, not string.
          console.log('SOCKET HANDSHAKE:', self.socket.handshake);
          if (!self.socket.handshake.user && !demo)
            return this('No user found');

          // Get the user.
          if (demo)

            // Create a new demo user.
            db.Users.create({username: com.key(), demo: true},
                {force: {username: 1}}, _.bind(function (err, user) {
              if (err) return this(err);
              this(null, user);
            }, this));
          else
            this(null, self.socket.handshake.user);
        },
        function (err, user) {
          if (err) return next(err);

          var author_id = user._id;
          if (_.isString(author_id))
            author_id = new db.oid(author_id);

          // Setup new dataset object.
          var props = {
            _id: did,
            public: data.public === 'true' || data.public,
            title: data.title,
            description: data.description,
            source: data.source,
            tags: com.tagify(data.tags),
            file: data.file,
            meta: {
              beg: firstBeg,
              end: lastEnd,
              channel_cnt: channels.length,
            },
            author_id: author_id,
            client_id: com.createId_32()
          };
          if (demo) props.demo = true;

          // Create dataset.
          if (channels.length === 0) return next('No channels found');
          db.Datasets.create(props, {force: {_id: 1, client_id: 1},
              inflate: {author: profiles.user}}, _.bind(function (err, doc) {
            if (err) return next(err);

            // Index for search.
            com.index(self.search, doc, ['title', 'source', 'tags']);

            dataset = doc;
            self.samples.insertSamples(dataset._id, sampleSet, next);
          }, next));
        }
      );
    },

    function (err) {
      if (err) return cb(err.toString());

      // Log to console.
      util.debug(color.bgBlackBright.white.bold('Worker '
          + cluster.worker.id + ': insertSamples:'));
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

      // Inc author dataset count.
      db.Users._update({_id: dataset.author._id}, {$inc: {dcnt: 1}},
          function (err) { if (err) util.error(err); });

      // Notify subscribers of event.
      if (!demo)
        self.pubsub.notify({
          actor_id: dataset.author._id,
          target_id: null,
          action_id: dataset._id, 
          data: {
            action: {
              i: dataset.author._id.toString(),
              a: dataset.author.displayName,
              u: dataset.author.username,
              g: dataset.author.gravatar,
              t: 'create'
            },
            target: {
              t: 'dataset',
              i: dataset._id.toString(),
              n: dataset.title,
              s: [dataset.author.username, dataset._id.toString()].join('/'),
              l: dataset.public === false
            }
          },
          public: dataset.public !== false
        });

      // Subscribe actor to future events.
      self.pubsub.subscribe(dataset.author, dataset,
          {style: 'watch', type: 'dataset'});

      // Broadcast to all clients.
      if (!demo)
        self.pubsub.publish('datasets', 'dataset.new', dataset);

      // Complete.
      cb(null, com.client(dataset));
    }
  );

}

// As a first pass, this function just does an internal fetchSamples and counts
// the number of samples.  If this becomes too slow, roll a custom function
// that does a DB query without all the overhead of fetchSamples
Client.prototype.exportCalculations = function (did, channel, beg, end, cb) {
  this.fetchSamples(did, channel, {beginTime: beg, endTime: end, minDuration: 0}, function(err, data) {
    cb(err, data.samples.length)
  })
}

