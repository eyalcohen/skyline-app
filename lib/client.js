/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var cluster = require('cluster');
var csv = require('csv');
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var XLS = require('xlsjs');
var XLSX = require('xlsx');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var Samples = require('skyline-samples-v1');
var collections = require('skyline-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../app');
var logger = require('./logger');

var CHANNELS = [
  'dataset',
  'view',
  'channel',
  'event',
  'note',
  'comment',
  'follow',
  'request',
  'accept',
  'watch'
];

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
    } else {
      queue.push(f);
    }
  };
}

// Constructor
var Client = exports.Client = function (webSock, backSock) {
  this.webSock = webSock;
  this.backSock = backSock;
  this.db = app.get('db');
  this.events = app.get('events');
  this.samples = app.get('samples');
  this.cache = app.get('cache');
  this.storage = app.get('storage');
  this.emailer = app.get('emailer');
  this.subscriptions = [];
  var user = webSock.handshake.user;

  // Join web socket rooms and subscribe to back-socket channels.
  _.each(CHANNELS, _.bind(function (c) {
    this.webSock.join(c);
    this.backSock.subscribe(c);
  }, this));
  // var user = this.webSock.handshake.user;
  if (user) {
    var uid = user._id.toString();
    this.webSock.join('usr-' + uid);
    this.backSock.subscribe('usr-' + uid);
  }

  // RPC handling
  this.webSock.on('rpc', _.bind(function () {

    // Parse arguments.
    var args = Array.prototype.slice.call(arguments);
    var handle = args.pop();
    var fnName = args.shift();
    var fn = this[fnName];
    if (!fn) {
      return this.webSock.emit(handle, 'Invalid method call');
    }

    // Log fn call.
    logger.write({
      user: user ? user.username: 'anon',
      rpc: fnName,
      args: args,
    });

    // Setup callback.
    var cb = _.bind(function (err, data) {
      this.webSock.emit(handle, err, data);
    }, this);
    args.push(cb);

    // Finally, call the method.
    fn.apply(this, args);
  }, this));

  // Relay back-end messages to websockets.
  this.backSock.on('message', _.bind(function (data) {
    // The data is a slow Buffer
    data = data.toString();
    // Now it's a string: channel + aspace + topic + aspace + jsonstring
    var channel = _.strLeft(data, ' ');
    data = data.substr(data.indexOf(' ') + 1);
    var topic = _.strLeft(data, ' ');
    data = JSON.parse(data.substr(data.indexOf(' ') + 1));

    // Privacy checks.
    //
    // If the event is private, it was sent directly to this socket, so no
    // access check is needed. If it's public, we only care to check datasets
    // and views for now because they are "top level", i.e. the front-end will
    // ignore a comment on a dataset that the user is not meant to see
    // (a user w/ e.p.m., not followed) because it doesn't have its parent.
    // TODO: make sure public flag exists on notes and comments so we can
    // avoid this insecurity.
    if ((topic === 'dataset.new' || topic === 'view.new')
        && data.public !== false) {
      hasAccess(this.db, user, data, _.bind(function (err, allow) {
        if (!err && allow) {
          _emit.call(this);
        }
      }, this));
    } else {
      _emit.call(this);
    }

    function _emit() {
      // Emit to front-end
      this.webSock.emit(topic, data);
    }
  }, this));

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);
}

/*
 * Subscribe to a channel.
 */
Client.prototype.channelSubscribe = function (channelName, cb) {
  if (_.contains(this.subscriptions, channelName)) {
    return;
  }
  this.subscriptions.push(channelName);
  this.webSock.join(channelName);
  this.backSock.subscribe(channelName);
  cb();
}

/*
 * Unsubscribe from a channel.
 */
Client.prototype.channelUnsubscribe = function (channelName, cb) {
  this.webSock.leave(channelName);
  this.backSock.unsubscribe(channelName);
  this.subscriptions = _.without(this.subscriptions, channelName);
  cb();
}

/*
 * Unsubscribe from all channels.
 */
Client.prototype.channelUnsubscribeAll = function (cb) {
  _.each(this.subscriptions, _.bind(function (cn) {
    this.webSock.leave(cn);
    this.backSock.unsubscribe(cn);
  }, this));
  this.subscriptions = [];
  cb();
}

/*
 * Fetch samples.
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


/* sendPartialFile
 * Send a portion of a file, supplying a callback for progress.
 * data {
 *  uid: A random number that is used to ID this file,
 *  file: {
 *    name: name.ext
 *    size:
 *    type: MIME type
 *    ext:
 *  },
 *  encodedSize: file size
 *  segement: The current segment of the data, the server tries to match this
 *  base64: Base64 encoded segment of data
 */

var chunk = {}
Client.prototype.sendPartialFile = function (data, cb) {

  var self = this;

  if (!data.file || !data.file.name || !data.uid) {
    cb('Invalid file');
  }
  var id = data.file.name.split('.')[0];
  id = id.replace(/[^a-zA-Z0-9]/g,"");
  id = id + '_' + data.uid;
  if (!chunk[id]) {
    chunk[id] = {}
    chunk[id].file = data.file;
    chunk[id].base64 = data.base64;
    chunk[id].expectedSize = data.encodedSize;
    chunk[id].currentSize = data.base64.length;
    chunk[id].segment = 0;

    // If the file upload process stops for some reason, at some point we need
    // to remove it from memory.
    // Short term: Additionally, send the file to someone
    // so they know that the upload was abandoned
    chunk[id].timeout = setTimeout(_.bind(function() {
      try {
        var mailerOptions = {
          text: 'File failed to upload or was abandoned ' + data.file.name +
                '\nUser ' + self.webSock.handshake.user.username,
          from: 'dunno',
          to: 'Eyal Cohen <eyal.cohen@skyline-data.com>',
          cc: 'Jit <jit@skyline-data.com>',
          subject: 'Failed to upload.',
          attachment: {
            data: this.base64,
            name: this.file.name,
            encoded: true // set if already base64. Docs say to avoid this...
          }
        }
        // send Eyal a mail if the file failed for now.
        //
        if (process.env.NODE_ENV === 'production')
          self.emailer.send(mailerOptions, function (err, res) {
        })
      } catch (e) {
        console.log('Failed to send Email', e);
      }
      delete this;
    }, chunk[id]), 20*60*1000, chunk[id]) // delete these files after 20 minutes
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

  // File upload complete
  if (chunk[id].currentSize === chunk[id].expectedSize) {

    // Save file to S3
    var params = {
      where: 'uploads-skyline',
      key:  '@' + (self.webSock.handshake.user.username || '') + '-'
          + chunk[id].file.name,
      data:  new Buffer(chunk[id].base64, 'base64'),
      contentType: 'application/octet-stream',
      access: 'private',
    }
    self.storage.store(params);
    cb(null, {fileId: id});
  } else {
    cb(null, {
      size: chunk[id].currentSize,
      segment: chunk[id].segment,
    })
  }
}


// These are key:pairs of formats used by Moment.js
// Array formats give Moment.js multiple options for parsing
// null formats are effectively handled by new Date()
var dateFormats = {
  'Skyline Guess':     { fmt: null,                         example : ''},
  'm-d-y':             { fmt: ['MM-DD-YY', 'MM-DD-YYYY'],   example : '5/23/1984'},
  'd-m-y':             { fmt: ['DD-MM-YY', 'DD-MM-YYYY'],   example : '23/5/1984'},
  'y-m-d':             { fmt: ['YY-DD-MM', 'YYYY-MM-DD'],   example : '1984/5/23'},
  'y':                 { fmt: ['YY', 'YYYY'],               example : '1984'},
  'm':                 { fmt: ['MM'],                       example : '5'},
  'd':                 { fmt: ['DD'],                       example : '23'},
  'month-y':           { fmt: ['MMM-YY', 'MMM-YYYY'],       example : 'May 1984'},
  'month-d-y':         { fmt: ['MMM-DD-YY', 'MMM-DD-YYYY'], example : 'May 23 1984'},
  'd-month-y':         { fmt: ['DD-MMM-YY', 'DD-MMM-YYYY'], example : '23 May 1984'},
  'ISO-8601':          { fmt: null,                         example : '1984-05-23'},
  'Unix time':         { fmt: null,                         example : '454118400'}
}

// NOTE: We do not support an array of formats for timeFormats
var timeFormats = {
  'h:m:s am/pm':    { fmt: 'hh:mm:ss a',     example : '4:30:45 PM' },
  'H':              { fmt: 'HH',             example : '16' },
  'H am/pm':        { fmt: 'hh a',           example : '4 PM' },
  'H:m':            { fmt: 'HH:mm',          example : '16:30' },
  'h:m am/pm':      { fmt: 'hh:mm a',        example : '4:30 PM' },
  'H:m:s':          { fmt: 'HH:mm:ss',       example : '16:30:45' },
  'H:m:s.ms':       { fmt: 'HH:mm:ss.SSS',   example : '16:30:45.10' },
  'h:m:s.ms am/pm': { fmt: 'hh:mm:ss.SSS a', example : '4:30:45.10 PM' },
  'm':              { fmt: 'mm',             example : '30' },
  'm:s':            { fmt: 'mm:ss',          example : '30:45' },
  's':              { fmt: 'ss',             example : '45 seconds' },
  's.ms':           { fmt: 'ss.SSS',         example : '45.10 seconds' },
  'ms':             { fmt: 'SSS',            example : '10 miliseconds' }
};

/* getDateTimeFormats
 * returns JSON objects with the date/time formats Skyline supports
 */

Client.getDateTimeFormats = function () {
  return {df: dateFormats, tf: timeFormats};
}

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


/* previewFileInsertion
 * Parses an incoming file using date/time information from the client.
 * The parsed data is stored on the server where it awaits insertion to the DB.
 * Returns information about the parsed data to the client
 *
 * obj = {
 *  fileId: <String>_<Number>
 *  skipHeaderRows: <Number>
 *  dateColumn: <String>
 *  dateFormat: <String>
 *  timeColumn: <String>
 *  timeFormat: <String>,
 * callback should have signature function(err, ret)
 * ret = {
 *  fileId: <String>_<Number>
 *  headers: Array[String]
 *  firstRows: Array[Obj], preview the first parsed rows
 *  lastRows: Array[Obj], preview the last parsed rows
 *  dateColumn: <String>
 *  dateFormat: <Obj>
 *  problemRow: Array[Obj], rows up to and including a row that failed to parse
*/

Client.prototype.previewFileInsertion = function (obj, cb) {

  if (!chunk || !chunk[obj.fileId]) {
    cb({message: 'file not found', notice: 'Try uploading again.', code: 404});
    return;
  }

  var buffer = new Buffer(chunk[obj.fileId].base64, 'base64');

  function parseCSV(str, cb) {

    // Skip first rows as requested
    obj.skipHeaderRows = Number(obj.skipHeaderRows);
    if (_.isNaN(obj.skipHeaderRows))
      obj.skipHeaderRows = null;

    if (obj.skipHeaderRows > 0) {
      str = str.split('\n').slice(obj.skipHeaderRows || 0).join('\n');
    }

    // handle tab-delimited formats
    // If we see  more tabs than commas?  Is this legit?
    if ((str.match(/\t/g) || []).length > (str.match(/,/g) || []).length) {
      // Commas are ok in TSV files, but lets replace them with spaces
      str = str.replace(/,/g, '').replace(/\t/g, ',');
    }

    // Make sure each header is unique by checking against the other headers
    /* TODO: Not working quite yet
    var split = str.split('\n');
    // this regex will spltit on commas but ignore commas in quotes.
    var headers = _.map(split[0].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).reverse(), function (m) {
      return m.trim();
    });
    var uniqueHeaders = _.map(headers, function (s, idx) {
      var s = s.trim();
      return (_.isBlank(s) || headers.slice(idx + 1).indexOf(s) === -1) ? s : s + '_' + idx;
    }).reverse().join(',');
    str = [uniqueHeaders].concat(split.slice(1)).join('\n');
    */

    csv().from.string(str,{columns: true})
      .to.array(function(rows, nn) { cb(null, rows, nn) }, {header: true})
      .on('error', function(err) { cb(err.toString()) });
  }

  function parseXLS(buf, cb) {
    var cfb = XLS.CFB.read(buf.toString('base64'), {type: 'base64'});
    var wb = XLS.parse_xlscfb(cfb);
    // lazy - turn .xls into .csv and parse, also only look at the first sheet
    var asCSV = XLS.utils.make_csv(wb.Sheets[wb.SheetNames[0]])
    parseCSV(asCSV, cb)
  }

  function parseXLSX(buf, cb) {
    var wb = XLSX.read(buf.toString('base64'), {type: 'base64'});
    // lazy - turn .xls into .csv and parse, also only look at the first sheet
    var asCSV = XLSX.utils.make_csv(wb.Sheets[wb.SheetNames[0]])
    parseCSV(asCSV, cb)
  }

  Step(

    // select our parsing mechanism based on file extension
    function () {
      var ext = chunk[obj.fileId].file.ext.toLowerCase();
      if (ext === 'xls') {
        parseXLS(buffer, this)
      } else if (ext === 'xlsx') {
        parseXLSX(buffer, this)
      } else {
        parseCSV(buffer.toString(), this)
      }
    },

    // Parse CSV returns an array of rows where the data is organized
    // as object with header:data for each row for some reason.
    function (err, rows, nn) {
      if (err) return this(err)

      // Get headers
      var headers = rows[0];
      rows = _.drop(rows);

      // Handle transpose.  Made  more complicated by the weird CSV format
      if (obj.transpose) {
        var newHeaders = [headers[0]];
        _.each(rows, function(r) {
            newHeaders.push(r[headers[0]]);
        });

        var firstRow = {}
        _.each(headers, function(h) {
          firstRow[h] = h;
        })

        rows = [firstRow].concat(rows);

        var newRows = _.map(headers, function(h) {
          var newRow = {};
          _.each(rows, function (r, i) {
            newRow[newHeaders[i]] = r[h];
          });
          return newRow;
        });

        rows = _.drop(newRows);
        headers = newHeaders;
        nn = newRows.length;
      }

      if (obj.reverse) {
        rows.reverse();
      }

      if (!rows || rows.length === 0) {
        return this('This dataset does not appear to have any valid data');
      }

      var dateColumn, dateFormatKey;

      if (headers.indexOf(obj.dateColumn) === -1)
        obj.dateColumn = null;

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
      var problemRow, lastGoodRow;
      _.find(rows, function(r, idx) {
        var m;
        var copyR = {};
        _.extend(copyR, r);

        // Don't do any processing on blank rows
        if (!r[dateColumn] || _.isBlank(r[dateColumn])) {
          return false;
        }

        // Parse date according to time and date formats supplied.  Note
        // that we do this in the loop because we may have to combine date
        // and time columns
        if (dateFormats[dateFormatKey]) {
          var str = r[dateColumn];
          var fmt = dateFormats[dateFormatKey].fmt;
          if (obj.timeFormat && timeFormats[obj.timeFormat]
              && timeFormats[obj.timeFormat].fmt) {
            if (obj.timeColumn && r[obj.timeColumn]) {
              str += ' ' + r[obj.timeColumn];
              if (fmt) {
                // We may have multiple formats in an array, so add
                // the timeformat ot all of them
                fmt = _.map(fmt, function (f) {
                  return f += ' ' + timeFormats[obj.timeFormat].fmt;
                });
              }
            }
          }
          m = fmt ? moment(str, fmt) : moment.utc(new Date(str));
        } else {
          m = moment.utc(new Date(r[dateColumn]));
        }

        var str = m.format();
        if (m.isValid() && str && str !== undefined) {
          r[dateColumn] = m.format();
        } else {
          problemRow = lastGoodRow ? [lastGoodRow].concat(copyR) : [copyR];
          err = 'We could not process the date at row ' + idx;
          return true;
        }

        // Check if date is increasing in this file.  TODO: Handle reverse dates
        if (idx > 0 && m.diff(prevM) < 0) {
          problemRow = lastGoodRow ? [lastGoodRow].concat(copyR) : [copyR];
          err = 'Time is not increasing at row ' + idx;
          return true;
        }

        if (!lastGoodRow) lastGoodRow = {};
        _.extend(lastGoodRow, copyR);

        prevM = m;

        return false;
      }, this);

      var ret = {
        fileId     : obj.fileId,
        headers    : headers || null,
        firstRows  : rows ? _.compact(_.first(rows, 3)) : null,
        lastRows   : rows ? _.compact(_.last(rows, 3))  : null,
        dateColumn : dateColumn || null,
        dateFormat : dateFormatKey || null,
        timeColumn : obj.timeColumn || null,
        timeFormat : obj.timeFormat || null,
        problemRow : _.compact(problemRow)
      };

      // some clenaup
      rows = _.filter(rows, function(r) {
        // Don't need a time column anymore
        if (obj.timeColumn)
          delete r[obj.timeColumn]

        // Remove blank rows
        return (r[dateColumn] && !_.isBlank(r[dateColumn]));
      });

      if (err) return this(err, ret);

      // Store information on server for use in database insertion
      if (chunk[obj.fileId]) {
        chunk[obj.fileId].rows = rows;
        chunk[obj.fileId].dateColumn = dateColumn;
      } else {
        return this('Lost file');
      }

      this(null, ret)
    },

    function (err, ret) {
      if (err) {
        console.log(err);
        cb(err, ret);
      } else {
        cb(null, ret);
      }
    }
  );
}

/* insertSamples
 * Insert a prevesiouly stored chunk of data into the database as a sample set
 * obj = {
 *  fileId: <String>_<Number>
 */

Client.prototype.insertSamples = function (obj, cb) {

  var sampleSet = {};
  var channels = [];

  var firstBeg = Infinity, lastEnd = -Infinity;
  var num = 0;
  var did = sutil.createId_32();
  var schema;
  var self = this;
  // FIXME:
  var demo = null;

  var id = obj.fileId;

  Step (

    // Step 1. Verify previous data from the server
    function () {
      if (chunk[id] && chunk[id].rows && chunk[id].dateColumn) {
        this(null, chunk[id].rows);
      } else {
        this('Server was unable to retrieve dataset');
      }
    },

    // Step 2. Create database sample set from data
    function (err, rows) {
      if (err) return this(err);
      var dateColumn = chunk[id].dateColumn;
      _.each(rows, _.bind(function (row, index) {
        var beg = new Date(row[dateColumn]).valueOf() * 1000;
        // FIXME: For now, we hack in a last sample with end = beg + 1.  
        // This is because a file with 3 lines will otherwise only have
        // two samples with 'beg' and 'end'
        var end = index != rows.length-1
                  ? new Date(rows[index+1][dateColumn]).valueOf() * 1000
                  : beg + 1;
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

      // File upload always connect samples beg-end, even if there are blanks
      // in the data
      _.each(sampleSet, function (samples, key) {
        var lastOk;
        _.each(samples, function (s) {
          if (lastOk && lastOk.end !== s.beg) {
            lastOk.end = s.beg;
          }
          lastOk = s;
        });
      });

      this();
    },

    // Step 3. Write out channel arrays from sample set
    function (err) {
      if (err) return this(err);
      var columns = _.keys(sampleSet);

      // Merge samples.
      _.each(sampleSet, Samples.mergeOverlappingSamples);

      var newColumns = [];

      // Add dummy schema samples.
      schema = [];
      _.each(columns, function (channelName) {
        var samples = sampleSet[channelName];
        if (!samples || samples.length === 0) return;
        var m = channelName.match(/^(.*) \(([^()]+)\)$/);
        var tmp1 = m ? m[1]: channelName;
        var tmp2 = tmp1 === '' ? sutil.key(): tmp1;

        // Create channel name
        var cn = _.slugify(_.prune(tmp2.toLowerCase(), 160, '')).replace(/-/g, '_');

        // Create unique channel name
        var cnCopy = cn;
        var num = 0;
        while (newColumns.indexOf(cnCopy) !== -1) {
          cnCopy = cn + '_' + num;
          num++;
        }
        newColumns.push(cnCopy);
        cn = cnCopy + '__' + did;

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
          if (!self.webSock.handshake.user && !demo) {
            return this('No user found');
          }

          // Get the user.
          if (demo) {

            // Create a new demo user.
            self.db.Users.create({username: sutil.key(), demo: true},
                {force: {username: 1}}, _.bind(function (err, user) {
              if (err) return this(err);
              this(null, user);
            }, this));
          } else {
            this(null, self.webSock.handshake.user);
          }
        },

        // Step 2. Add to the dataset collection
        function (err, user) {
          if (err) return this(err);

          var author_id = user._id;
          if (_.isString(author_id)) {
            author_id = new self.db.oid(author_id);
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
            client_id: sutil.createId_32()
          };
          if (demo) {
            props.demo = true;
          }
          sutil.removeEmptyStrings(props);

          // Create dataset.
          if (channels.length === 0) {
            return this('No channels found');
          }
          self.db.Datasets.create(props, {force: {_id: 1, client_id: 1},
              inflate: {author: profiles.user}}, _.bind(function (err, doc) {
            if (err) return this(err);
            dataset = doc;
            dataset.channels = [];
            dataset.channels_cnt = channels.length;

            // Index for search.
            self.cache.index('datasets', doc, ['title', 'source', 'tags'],
                this.parallel());
            self.cache.index('datasets', doc, ['title', 'source'],
                {strategy: 'noTokens'}, this.parallel());

            // Add samples.
            self.samples.insertSamples(dataset._id, sampleSet, this.parallel());
          }, this));
        },

        // Step 3. Add to the channels collection
        function (err) {
          if (err) return this(err);

          var group = this.group();

          _.each(schema, function (s) {
            s.humanName = _.prune(s.humanName, 64, '');
            _.extend(s, {
              parent_id: did,
              author_id: dataset.author._id
            });
            self.db.Channels.create(s, group());
          });
        },
        function (err, channels) {
          if (err) return this(err);
          if (dataset.channels.length < 5) {
            dataset.channels = dataset.channels.concat(channels);
          }

          // Index for search.  Don't care if this fails, so no callback.
          _.each(channels, function (c) {
            self.cache.index('channels', c, ['humanName'], null);
            self.cache.index('channels', c, ['humanName'], {strategy: 'noTokens'});
          });

          return this;
        },
        next
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

      delete chunk[id];

      // Add empty comments for client.
      dataset.comments = [];
      dataset.comments_cnt = 0;

      if (!demo) {

        // Publish dataset.
        self.events.publish('dataset', 'dataset.new', {
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
        self.events.subscribe(self.webSock.handshake.user, dataset,
            {style: 'watch', type: 'dataset'});
      }

      // Complete.
      cb(null, sutil.client(dataset));
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

