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
var XLS = require('xlsjs')

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
  this.channelSearch = reds.createSearch('channels');

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

/* sendPartialFile - Upload Stage 1 */

var chunk = {}

Client.prototype.sendPartialFile = function (data, cb) {
  if (!data.file || !data.file.name || !data.uid) {
    cb('Invalid file');
  }
  var id = data.file.name.split('.')[0] + '_' + data.uid;
  if (!chunk[id]) {
    chunk[id] = {}
    chunk[id].file = data.file;
    chunk[id].base64 = data.base64;
    chunk[id].expectedSize = data.encodedSize;
    chunk[id].currentSize = data.base64.length;
    chunk[id].segment = 0;
    chunk[id].timeout = setTimeout(function() {
      delete chunk[id];
    }, 1000*60*10); // delete these files after 10 minutes
  } else {
    // error handling
    if (JSON.stringify(chunk[id].file) === JSON.stringify(data.file) &&
        chunk[id].segment === data.segment - 1) {
      chunk[id].base64 += data.base64;
      chunk[id].currentSize += data.base64.length;
      chunk[id].segment = chunk[id].segment + 1;
    }
    else {
      cb('Invalid file');
    }
  }

  if (chunk[id].currentSize == chunk[id].expectedSize) {
    // post-processing
    parseAndCheckFile(chunk[id], cb);
  } else {
    cb(null, { 
      size: chunk[id].currentSize, 
      segment: chunk[id].segment,
    })
  }

}

/* parseTimecol - tries to figure out where the time column is based on heuristics
 * row is an object with a map of header:val pairs
 * We try to do some intelligent guessing of which column is the the time-series
 * basis.  We do this by applying some rules (first column is most lkely,
 * columns with key words etc).
 * Finally, we try to give some hints on how to parse the column based
 * on the name of the header
 */
function parseTimecol(row) {

  // fuzzy match on which column is the most likely to be date/time
  var headerScore = {};

  var result = {
    column: '',
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
  result.parseHints = ['Year', 'Month', 'Day', 'Hour', 'Minute', 'Second',
                       'Millisecond', 'Date', 'Epoch time'];

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

/* parseAndCheckFile - parses the incoming file, does some checking, 
 * and returns object information
 */
function parseAndCheckFile(data, cb) {

  var self = this;
  var buffer = new Buffer(data.base64, 'base64');
  //var demo = data.user === 'demo';
  var timecolGuess;

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

  Step(

    // select our parsing mechanism based on file extension
    function () {
      if (data.file.ext.toLowerCase() === 'csv') {
        parseCSV(this)
      } else if (data.file.ext.toLowerCase() === 'xls') {
        parseXls(this)
      } else {
        return this('Unsupported file extension ' + data.file.ext)
      }
    },

    function (err, rows, nn) {
      if (err) return this(err)
      if (!rows || rows.length === 0) {
        return this('This dataset does not appear to have any valid data');
      }
      var tmp = {};
      _.each(rows[0], function (value, key) {
        tmp[key.toLowerCase().trim()] = key;
      });

      timecolGuess = parseTimecol(rows[0]);
      if (timecolGuess.column === '')
        return this('Could not find time, date, or datetime column');

      this(null, rows, nn)
    },

    function (err, rows, nn) {
      if (err) {
        delete data;
        console.log('File parsing err' + err);
        cb(err);
      } else {
        data.rows = rows;
        data.nn = nn;
        cb(null, {
          timecolGuess: timecolGuess,
          channelNames: Object.keys(rows[0])
        });
      }
    }
  );
}

/* insertSamples - Upload stage 2. It takes a payload with meta data
 * from the client as indication that it should attempt database insertion
 */
Client.prototype.insertSamples = function (payload, cb) {

  var id = payload.fileName.split('.')[0] + '_' + payload.uid;
  var sampleSet = {};
  var channels = [];
  var timecol = payload.timecol;
  var dateHint = payload.timecolformat.toLowerCase();
  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;
  var did = com.createId_32();
  var self = this;
  var demo = payload.user === 'demo';

  Step (

    // Step 1. Verify previous data from the server
    function () {
      if (chunk[id] && chunk[id].rows && chunk[id].nn) {
        this(null, chunk[id].rows, chunk[id].nn);
      } else {
        this('Server was unable to retrieve dataset');
      }
    },

    // Step 2. Create database sample set from data
    function (err, rows, nn) {
      if (err) return this(err);
 
      var parseAsNum = !isNaN(rows[0][timecol]);
      var prevEnd = -Number.MAX_VALUE;

      // Test if time is going backwards. If so, hey, lets try to reverse.
      // If its STILL wrong, this probably isn't going to work.
      function checkIncreasingDate() {
        // find instances of time going backwards.  find() stops when true
        var badmatch = _.find(rows, function(row) {
          if (row[timecol] === '') return false;
          var date = new Date(parseAsNum
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

      _.each(rows, _.bind(function (row, index) {

        // uses the date hint to parse the time in ms since unix epoch
        function getDate(r) {
          var d = new Date(0);
          if (r[timecol] === '') return;
          var input = r[timecol].valueOf();
          if (dateHint === 'year')
            d = d.setUTCFullYear(input).valueOf();
          else if (dateHint === 'month')
            d = d.setUTCMonth(input).valueOf();
          else if (dateHint === 'day')
            d = d.setUTCDate(input).valueOf();
          else if (dateHint === 'hour')
            d = d.setUTCHours(input).valueOf();
          else if (dateHint === 'minute')
            d = d.setUTCMinutes(input).valueOf();
          else if (dateHint === 'second')
            d = d.setUTCMilliseconds(input * 1000).valueOf();
          else if (dateHint === 'millisecond')
            d = d.setUTCMilliseconds(input).valueOf();
          else if (parseAsNum)
            d = input;
          else
            d = new Date(r[timecol]).valueOf();
          if (isNaN(d)) return;
          d = d * 1e3;
          return d;
        }

        var beg = getDate(row);
        var end = index != rows.length-1 ? getDate(rows[index+1]) : beg+1;
        firstBeg = Math.min(firstBeg, beg);
        lastEnd = Math.max(lastEnd, end);
        _.each(row, function (value, key) {
          if (key !== timecol && payload.channels[key].enabled
              && value !== null && value !== '') {
            if (!sampleSet[key]) sampleSet[key] = [];

            // Strip anything after a colon.
            value = value.match(/^([^:]*)/)[1];

            // Remove dollar signs.
            value = value.replace(/[\$,]/g, '');

            // Remove dollar signs.
            value = value.replace('$', '');

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

    // Step 3. Write out channel arrays from sample set
    function (err) {
      if (err) return this(err);
      var columns = _.keys(sampleSet);

      // Merge samples.
      _.each(sampleSet, Samples.mergeOverlappingSamples);

      // Add dummy schema samples.
      schema = [];
      _.each(columns, function (channelName) {
        var samples = sampleSet[channelName];
        if (!samples || samples.length === 0) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var tmp1 = m ? m[1]: channelName;
        var tmp2 = tmp1 === '' ? com.key(): tmp1;
        var cn = _.slugify(_.prune(tmp2.toLowerCase(), 40, '')).replace(/-/g, '_')
            + '__' + did;
        var humanName = payload.channels[channelName].humanName;
        if (humanName === '') {
          humanName = tmp1;
        }
        if (humanName === '') {
          humanName = 'Untitled';
        }
        var v = {
          beg: _.first(samples).beg,
          end: _.last(samples).end,
          channelName: cn,
          humanName: humanName,
          type: 'float',
          merge: true,
        };
        if (m) v.units = m[2].replace('_', '/');
        schema.push(v);
        sampleSet[cn] = samples;
        delete sampleSet[channelName];
        channels.push(cn);
      });

      // Samples are ready.
      this();
    },

    // Step 4. Write to database
    function (err) {
      if (err) return this(err);
      var next = this;

      Step(

        // Step 1. Get the user
        function () {
          // Ensure user id is object id, not string.
          if (!self.socket.handshake.user && !demo) {
            return this('No user found');
          }

          // Get the user.
          if (demo) {

            // Create a new demo user.
            db.Users.create({username: com.key(), demo: true},
                {force: {username: 1}}, _.bind(function (err, user) {
              if (err) return this(err);
              this(null, user);
            }, this));
          } else {
            this(null, self.socket.handshake.user);
          }
        },

        // Step 2. Add to the dataset collection
        function (err, user) {
          if (err) return this(err);

          var author_id = user._id;
          if (_.isString(author_id)) {
            author_id = new db.oid(author_id);
          }

          // Setup new dataset object.
          var props = {
            _id: did,
            public: payload.public === 'true' || payload.public,
            title: payload.title,
            description: payload.description,
            source: payload.source,
            sourceLink: payload.sourceLink,
            tags: com.tagify(payload.tags),
            file: chunk[id].file,
            author_id: author_id,
            client_id: com.createId_32()
          };
          if (demo) {
            props.demo = true;
          }
          com.removeEmptyStrings(props);

          // Create dataset.
          if (channels.length === 0) {
            return this('No channels found');
          }
          db.Datasets.create(props, {force: {_id: 1, client_id: 1},
              inflate: {author: profiles.user}}, _.bind(function (err, doc) {
            if (err) return this(err);
            dataset = doc;
            dataset.channels = [];
            dataset.channels_cnt = channels.length;

            // Index for search.
            com.index(self.search, dataset, ['title', 'source', 'tags']);

            // Add samples.
            self.samples.insertSamples(dataset._id, sampleSet, this);
          }, this));
        },

        // Step 3. Add to the channels collection
        function (err) {
          if (err) return this(err);

          var _this = _.after(_.size(schema), this);
          _.each(schema, function (s) {
            s.humanName = _.prune(s.humanName, 40, '');
            _.extend(s, {
              parent_id: did,
              author_id: dataset.author._id
            });
            db.Channels.create(s, function (err, channel) {
              if (err) return _this(err);
              if (dataset.channels.length < 5) {
                dataset.channels.push(channel);
              }

              // Index for search.
              com.index(self.channelSearch, channel, ['humanName']);

              // TODO: Consider publishing channel here...
              // pubsub.publish('channel', 'channel.new', {
              //   data: channel,
              //   event: ...
              // });

              _this();
            });
          });
        }, next
      );
    },

    // Step 6. Log and clean up
    function (err) {
      if (err) return cb(err.toString());

      // Log to console.
      util.debug(color.bgBlackBright.white.bold('Worker '
          + cluster.worker.id + ': insertSamples:'));
      util.debug(color.blackBright('  file name = ')
          + color.red.bold(payload.title));
      util.debug(color.blackBright('  file size = ')
          + color.red.bold(chunk[id].file.size));
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

      // Add empty comments for client.
      dataset.comments = [];
      dataset.comments_cnt = 0;

      if (!demo) {

        // Publish dataset.
        self.pubsub.publish('dataset', 'dataset.new', {
          data: dataset,
          event: {
            actor_id: dataset.author._id,
            target_id: null,
            action_id: dataset._id,
            action_type: 'dataset',
            data: {
              action: {
                i: dataset.author._id.toString(),
                a: dataset.author.displayName,
                u: dataset.author.username,
                g: dataset.author.gravatar,
                t: 'dataset',
                n: dataset.title,
                b: _.prune(dataset.description, 40),
                s: [dataset.author.username, dataset._id.toString()].join('/')
              }
            },
            public: dataset.public !== false
          }
        });

        // Subscribe actor to future events.
        self.pubsub.subscribe(self.socket.handshake.user, dataset,
            {style: 'watch', type: 'dataset'});
      }

      // Complete.
      cb(null, com.client(dataset));
    }
  );
}

// As a first pass, this function just does an internal fetchSamples and counts
// the number of samples. If this becomes too slow, roll a custom function
// that does a DB query without all the overhead of fetchSamples
Client.prototype.exportCalculations = function (did, channel, beg, end, cb) {
  this.fetchSamples(did, channel, {beginTime: beg, endTime: end, minDuration: 0},
      function (err, data) {
    cb(err, data.samples.length)
  })
}

