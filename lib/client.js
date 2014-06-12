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
var XLS = require('xlsjs');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

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

    //
    // save file
    var dirname = path.dirname(process.mainModule.filename) + '/uploaded';
    fs.mkdir(dirname, '0755', function (err) {
      fs.writeFile(dirname + '/' + chunk[id].file.name,
                   chunk[id].base64, null, function (err) {
        if (err) console.log(err);
        else
          console.log('Saved ' + dirname + '/' + chunk[id].file.name);
      });
    });
    cb(null, { fileId: id});
  } else {
    cb(null, {
      size: chunk[id].currentSize,
      segment: chunk[id].segment,
    })
  }
}

var dateFormats = {
  'Skyline Guess':     { fmt: null,                         example : ''},
  'm-d-y':             { fmt: ['MM-DD-YY', 'MM-DD-YYYY'],   example : '5/23/1984'},
  'd-m-y':             { fmt: ['DD-MM-YY', 'DD-MM-YYYY'],   example : '23/5/1984'},
  'y':                 { fmt: ['YY', 'YYYY'],               example : '1984'},
  'm':                 { fmt: ['MM'],                       example : '5'},
  'd':                 { fmt: ['DD'],                       example : '23'},
  'month-y':           { fmt: ['MMM-YY', 'MMM-YYYY'],       example : 'May 1984'},
  'month-d-y':         { fmt: ['MMM-DD-YY', 'MMM-DD-YYYY'], example : 'May 23 1984'},
  'd-month-y':         { fmt: ['DD-MMM-YY', 'DD-MMM-YYYY'], example : '23 May 1984'},
  'ISO-8601':          { fmt: null,                         example : '1984-05-23'},
  'Unix time':         { fmt: null,                         example : '454118400'}
}

var timeFormats = {
  'H':              { fmt: 'HH',             example : '16' },
  'H am/pm':        { fmt: 'hh a',           example : '4 PM' },
  'H:m':            { fmt: 'HH:mm',          example : '16:30' },
  'h:m am/pm':      { fmt: 'hh:mm a',        example : '4:30 PM' },
  'H:m:s':          { fmt: 'HH:mm:ss',       example : '16:30:45' },
  'h:m:s am/pm':    { fmt: 'hh:mm:ss a',     example : '4:30:45 PM' },
  'H:m:s.ms':       { fmt: 'HH:mm:ss.SSS',   example : '16:30:45.10' },
  'h:m:s.ms am/pm': { fmt: 'hh:mm:ss.SSS a', example : '4:30:45.10 PM' },
  'm':              { fmt: 'mm',             example : '30' },
  'm:s':            { fmt: 'mm:ss',          example : '30:45' },
  's':              { fmt: 'ss',             example : '45 seconds' },
  's.ms':           { fmt: 'ss.SSS',         example : '45.10 seconds' },
  'ms':             { fmt: 'SSS',            example : '10 miliseconds' }
};

Client.prototype.getDateTimeFormats = function (cb) {
  cb(null, {df: dateFormats, tf: timeFormats});
}

// a b c
// 1 2 3
// 4 5 6
//
// a 1 4
// b 2 5
// c 3 6
//
// [ {a: 1}, {b: 2}, {c: 3},
//   {a: 4}, {b: 5}, {c: 6}
// ]
//
// [ {a: 1}, {1: 2}, {4: 3},
//   {a: 4}, {1: 5}, {4: 6}
// ]
/*
var transpose(rows) {
  var newKeys = [];
  var newRows = [];

  var keys = _.keys(rows[0]);
  _.each(rows[0]) {
    newRows.push(
  }
}
*/

/* parseTimecol - tries to figure out where the time column is based on heuristics
 * row is an object with a map of header:val pairs
 * We try to do some intelligent guessing of which column is the the time-series
 * basis.  We do this by applying some rules (first column is most lkely,
 * columns with key words etc).
 * Finally, we try to give some hints on how to parse the column based
 * on the name of the header
 * @returns obj {
 *   column: <String>
 *   parseHints: <List>
 *   dateHint: <List>
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
    result.dateHint = 'y';
  } else if (header.indexOf('month') != -1) {
    result.dateHint = 'm';
  } else if (header.indexOf('day') != -1) {
    result.dateHint = 'd';
  } else if (header.indexOf('hour') != -1) {
    hesult.dateHint = 'h';
  } else if (header.indexOf('minute') != -1) {
    result.dateHint = 'm';
  } else if (header.indexOf('second') != -1) {
    result.dateHint = 's';
  } else {
    result.dateHint = 'Skyline Guess';
  }

  return result;
}


/* obj = {
 *  fileId: <String>_<Number>
 *  skipHeaderRows: <Number>
 *  dateColumn: <String>
 *  dateFormat: <String>
 *  timeColumn: <String>
 *  timeFormat: <String>
*/

/* cb(err, ret)
 * ret = {
 *  fileId: <String>_<Number>
 *  headers: Array[String]
 *  firstRows: Array[Array[String]]
 *  lastRows: Array[Array[String]]
 *  dateColumn: <String>
 *  dateFormat: <String>
 *  problemRow: <Number>
*/

Client.prototype.previewFileInsertion = function (obj, cb) {

  console.log(obj);

  // sanitize inputs
  if (!chunk[obj.fileId]) {
    cb("Working on an unknown file");
  }

  var self = this;
  var data = chunk[obj.fileId];
  var buffer = new Buffer(chunk[obj.fileId].base64, 'base64');

  // typical format is an array of rows followed by a count
  function parseCSV(str, cb) {
    // skip first rows if requested
    obj.skipHeaderRows = Number(obj.skipHeaderRows);
    if (_.isNaN(obj.skipHeaderRows))
      obj.skipHeaderRows = null;

    str = str.split('\n').slice(obj.skipHeaderRows || 0).join('\n');

    // handle tab-delimited formats
    str.replace(/\t/g, ',');
    csv().from.string(str,{columns: true})
      .to.array(function(rows, nn) {
        cb(null, rows, nn)
    }, {header: true});
  }

  function parseXLS(buf, cb) {
    var cfb = XLS.CFB.read(buf.toString('base64'), {type: 'base64'});
    var wb = XLS.parse_xlscfb(cfb);
    // lazy - turn .xls into .csv and parse, also only look at the first sheet
    var asCSV = XLS.utils.make_csv(wb.Sheets[wb.SheetNames[0]])
    parseCSV(asCSV, cb)
  }

  Step(

    // select our parsing mechanism based on file extension
    function () {
      if (data.file.ext.toLowerCase() === 'xls') {
        parseXLS(buffer, this)
      } else {
        parseCSV(buffer.toString(), this)
      }
    },

    function (err, rows, nn) {
      if (err) return this(err)

      // Get headers
      var headers = rows[0];
      rows = _.drop(rows);

      // handle transpose
      if (obj.transpose) {
        var newHeaders = [headers[0]];
        _.each(rows, function(r) {
            newHeaders.push(r[headers[0]]);
        });

        var newRows = _.map(_.drop(headers), function(h) {
            var newRow = {};
            _.each(rows, function (r, i) {
                newRow[newHeaders[i+1]] = r[h];
            });
            return newRow;
        });

        rows = newRows;
        headers = newHeaders;
        nn = newRows.length;
      }

      if (!rows || rows.length === 0) {
        return this('This dataset does not appear to have any valid data');
      }

      var dateColumn, dateFormatKey;

      // If we don't supply date columns and formats, server will guess
      if (!obj.dateColumn || !obj.dateFormat) {
        timecolGuess = parseTimecol(rows[0]);
        dateColumn = timecolGuess.column;
        dateFormatKey = timecolGuess.dateHint;
      } else {
        dateColumn = obj.dateColumn;
        dateFormatKey = obj.dateFormat
      }

      // We're using _.find to break the iteration when a statement returns a
      // non-false statement
      var err;
      var prevM;
      _.find(rows, function(r, idx) {
        var m;

        if (dateFormats[dateFormatKey]) {
          var str = r[dateColumn];
          var fmt = dateFormats[dateFormatKey].fmt;
          if (obj.timeFormat && timeFormats[obj.timeFormat]
              && timeFormats[obj.timeFormat].fmt) {
            if (obj.timeColumn && r[obj.timeColumn]) {
              str += ' ' + r[obj.timeColumn];
              if (fmt)
                fmt += ' ' + timeFormats[obj.timeFormat].fmt
            }
          }
          m = fmt ? moment(str, fmt) : moment(str);
        } else {
          m = moment(r[dateColumn]);
        }

        var str = m.format();
        if (m.isValid() && str) {
          r[dateColumn] = m.format();
          if (obj.timeColumn) {
            delete r[obj.timeColumn];
          }
        } else {
          err = 'We could not process the date at row ' + idx;
          return true;
        }

        if (idx > 0 && m.diff(prevM) < 0) {
          err = 'Time is not increasing at row ' + idx;
          return true;
        }

        prevM = m;

        return false;
      }, this);

      var ret = {
        fileId: obj.fileId,
        headers: headers || null,
        firstRows: rows ? _.first(rows, 3) : null,
        lastRows: rows ? _.last(rows, 3) : null,
        dateColumn: dateColumn || null,
        dateFormat: dateFormatKey || null,
        timeColumn: obj.timeColumn || null,
        timeFormat: obj.timeFormat || null,
      };

      if (err) return this(err, ret);

      if (chunk[obj.fileId]) {
        chunk[obj.fileId].rows = rows;
        chunk[obj.fileId].nn = nn;
        chunk[obj.fileId].dateColumn = dateColumn;
      } else {
        return this('Lost file');
      }

      this(null, ret)
    },

    function (err, ret) {
      if (err) {
        console.log(err, ret);
        cb(err, ret);
      } else {
        cb(null, ret);
      }
    }
  );
}

/* insertSamples - Upload stage 2. It takes a payload with meta data
 * from the client as indication that it should attempt database insertion
 */

/* obj = {
 *  fileId: <String>_<Number>
*/

Client.prototype.insertSamples = function (obj, cb) {

  var sampleSet = {};
  var channels = [];

  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;
  var did = com.createId_32();
  var schema;
  var self = this;
  // FIXME:
  var demo = null;

  var id = obj.fileId;

  Step (

    // Step 1. Verify previous data from the server
    function () {
      if (chunk[id] && chunk[id].rows && chunk[id].nn && chunk[id].dateColumn) {
        this(null, chunk[id].rows, chunk[id].nn, chunk[id].dateColumn);
      } else {
        this('Server was unable to retrieve dataset');
      }
    },

    // Step 2. Create database sample set from data
    function (err, rows, nn) {
      if (err) return this(err);
      var dateColumn = chunk[id].dateColumn;
      _.each(rows, _.bind(function (row, index) {
        var beg = new Date(row[dateColumn]).valueOf();
        var end = index != rows.length-1
                  ? new Date(rows[index+1][dateColumn]).valueOf()
                  : beg;
        firstBeg = Math.min(firstBeg, beg);
        lastEnd = Math.max(lastEnd, end);
        if (beg !== end) {
          _.each(row, function (value, key) {
            if (key !== dateColumn // && payload.channels[key].enabled
                && value !== null && value !== '') {
              if (!sampleSet[key]) sampleSet[key] = [];

              // Strip anything after a colon.
              value = value.match(/^([^:]*)/)[1];

              // Remove some special characters
              value = value.replace(/[$,%]/g, '');

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
        }
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
        // FIXME
        //var humanName = payload.channels[channelName].humanName;
        var humanName = '';
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
            public: true,
            title: chunk[id].file.name.split('.')[0],
            description: '',
            source: '',
            sourceLink: '',
            tags: '',
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
              if (dataset.channels.length < 5
                  || dataset.author.role === 2) {
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
      if (err) {
        util.error(err.toString());
        return cb(err.toString());
      }

      // Log to console.
      util.debug(color.bgBlackBright.white.bold('Worker '
          + cluster.worker.id + ': insertSamples:'));
      util.debug(color.blackBright('  file name = ')
          + color.red.bold(chunk[id].file.name));
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

