#!/usr/bin/env node

/**
 * Arguments.
 */
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 8080)
    .describe('db', 'MongoDb URL to connect to')
      .default('db', 'mongo:///service-samples')
      // .default('db', 'mongo://10.201.227.195:27017,10.211.174.11:27017,10.207.62.61:27017/service-samples')  // old production
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

/**
 * Module dependencies.
 */

var express = require('express');
var mongoose = require('mongoose');
var ObjectID = require('mongoose/lib/types/objectid');
var jade = require('jade');
var mongodb = require('mongodb');
var MongoStore = require('connect-mongodb');
var gzip = require('connect-gzip');
var dnode = require('dnode');
var fs = require('fs');
var path = require('path');
var CSV = require('csv');
var traverse = require('traverse');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var Buffers = require('buffers')
var EventID = require('./customids').EventID;
var models = require('./models');
var EventDescFileName = __dirname +
    '/../mission-java/common/src/main/protobuf/Events.desc';
var WebUploadSamples, EventWebUpload;
try {
  var ProtobufSchema = require('protobuf_for_node').Schema;
  var Event = new ProtobufSchema(fs.readFileSync(EventDescFileName));
  WebUploadSamples = Event['event.WebUploadSamples'];
  EventWebUpload = Event['event.EventWebUpload'];
} catch (e) {
  console.warn('Could not load proto buf ' + EventDescFileName +
               ', upload APIs won\'t work!');
}
var getrusage;
try {
  getrusage = require('getrusage');
} catch (e) {
  console.warn('Could not load getrusage module, try: node_modules/build.sh');
}
var Notify = require('./notify');
var SampleDb = require('./sample_db.js').SampleDb;
var compatibility = require('./compatibility.js');

var db, User, Vehicle, AppState;

var pubsub = require('./minpubsub');
var jadeify = require('jadeify');

/////////////// Helpers


/**
 * Wraps a callback f to simplify error handling.  Specifically, this:
 *   asyncFunction(..., errWrap(cb, function(arg) {
 *     ...
 *     cb(...);
 *   }));
 * is equivalent to:
 *   asyncFunction(..., function(err, arg) {
 *     if (err) { cb(err); return; }
 *     try {
 *       ...
 *       cb(...);
 *     } catch (err2) {
 *       cb(err2);
 *     }
 *   }));
 */
function errWrap(next, f) {
  return function(err) {
    if (err) { next(err); return; }
    try {
      f.apply(this, Array.prototype.slice.call(arguments, 1));
    } catch (err) {
      next(err);
    }
  }
}


/**
 * Gets all vehicles owned by user or all if user is null.
 */
function findVehiclesByUser(user, next) {
  var filter;
  if (!user) {
    filter = {};
  } else if (user.length) {
    filter = { user_id: { $in: user }};
  } else {
    filter = { user_id: user._id };
  }
  Vehicle.find(filter).sort('created', -1).run(function (err, vehs) {
    if (!err) {
      next(vehs);
    } else {
      next([]);
    }
  });
}


/**
 * Finds a single vehicle by integer id
 */
function findVehicleByIntId(id, next) {
  if ('string' === typeof id) {
    id = parseInt(id);
  }
  Vehicle.collection.findOne({ _id: id }, function (err, veh) {
    next(veh);
  });
}


/**
 * Find an app state object describing a GUI layout
 */
function fetchAppState(data, cb) {
  AppState.findOne({ key: data }, function (err, state) {
    cb(err, state);
  });
}

/////////////// Configuration

// if (process.env.NODE_ENV && process.env.NODE_ENV == 'production')
//   var app = module.exports = express.createServer({
//     key: fs.readFileSync(__dirname + '/keys/production/privatekey.pem'),
//     cert: fs.readFileSync(__dirname + '/keys/production/certificate.pem'),
//   });
// else
var app = module.exports = express.createServer();

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});


app.configure('production', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = true;
});


function rawBody(rawMimeTypes) {
  return function(req, res, next) {
    if ('GET' == req.method || 'HEAD' == req.method) return next();
    var mimeType = (req.headers['content-type'] || '').split(';')[0];
    if (_.contains(rawMimeTypes, mimeType) && !req.body) {
      // req.setEncoding(null);
      var bufs = Buffers();
      req.on('data', function(chunk) { bufs.push(chunk); });
      req.on('end', function() {
        req.rawBody = bufs.toBuffer();
        next();
      });
    } else {
      next();
    }
  }
}


app.configure(function () {
  // Use gzip compression for all responses.
  // Note that this adds computation cost and latency, but will help
  // significantly on low-bandwidth connections.
  // Note: right now, this uses a gzip process to do the compression -
  // expensive!  TODO: make a binary module with zlib library support.
  app.use(gzip.gzip({flags: '-1'}));

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(rawBody(['application/octet-stream']));
  app.use(express.cookieParser());

  // var sessionServerDb =
  //     mongodb.connect(argv.db, { noOpen: true }, function() {});
  // app.use(express.session({
  //   cookie: { maxAge: 86400 * 1000 * 7 }, // one day 86400
  //   secret: 'topsecretmission',
  //   store: new MongoStore({ db: sessionServerDb, }, function (err) {
  //     if (err) util.log('Error creating MongoStore: ' + err);
  //   })
  // }));
  app.use(express.logger({ format: function(tok, req, res) {
    var url = tok.url(req, res) || '-';
    if (/^\/status/(url)) return;
    return '\x1b[1m' + (tok.method(req, res) || '-') + '\x1b[0m ' +
        '\x1b[33m' + (tok.url(req, res) || '-') + '\x1b[0m ' +
        tok['response-time'](req, res) + ' ms';
  } }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  var start = Date.now();
  app.use(require('browserify')({
    require : ['dnode', 'underscore', 'step', './minpubsub', './shared_utils']
  }).use(jadeify(__dirname + '/public/javascripts/templates')));
  util.log('browserify took: ' + (Date.now() - start) + 'ms.');
});


models.defineModels(mongoose, function () {
  app.User = User = mongoose.model('User');
  app.Vehicle = Vehicle = mongoose.model('Vehicle');
  app.AppState = AppState = mongoose.model('AppState');

  // Ugh: parse mongodb-style URL and convert to a mongoose-compatible one.
  var match = argv.db.match(
      new RegExp('^mongo(?:db)?://(?:|([^@/]*)@)([^@/]*)(?:|/([^?]*)(?:|\\?([^?]*)))$'));
  if (!match)
    throw Error("URL must be in the format mongodb://user:pass@host:port/dbname");

  var authPart = match[1] || '';
  var auth = authPart.split(':', 2);
  var hostPart = match[2];
  var dbname = match[3] || 'default';
  var urlOptions = (match[4] || '').split(/[&;]/);
  if (urlOptions != '')
    throw Error('URL options in mongodb URL not handled yet: ' + urlOptions);

  var servers = hostPart.split(',').map(function(h) {
    var hostPort = h.split(':', 2);
    return { host: hostPort[0] || 'localhost',
             port: hostPort[1] != null ? parseInt(hostPort[1]) : 27017 };
  });
  var mongooseUri = 'mongodb://' + (authPart ? authPart + '@' : '') +
      servers[0].host + ':' + servers[0].port + '/' + dbname;
  if (servers.length == 1) {
    util.log('Connecting to mongoose DB: ' + mongooseUri);
    db = mongoose.connect(mongooseUri);
  } else {
    mongooseUri += ',';
    mongooseUri += _.rest(servers).map(function(server) {
      return 'mongodb://' + server.host + ':' + server.port;
    }).join(',');
    util.log('Connecting to mongoose DB set: ' + mongooseUri);
    db = mongoose.connectSet(mongooseUri);
  }
});


/////////////// Params


/**
 * Loads user by email request param.
 */

app.param('email', function (req, res, next, email) {
  User.findOne({ email: email }, errWrap(next, function (usr) {
    if (usr) {
      var pass = req.query.password || req.body.password;
      if (usr.authenticate(pass)) {
        req.currentUser = usr;
        next();
      } else {
        res.send({ status: 'fail', data: { code: 'INCORRECT_PASSWORD' } }, 400);
      }
    } else {
      res.send({ status: 'fail', data: { code: 'USER_NOT_FOUND' } }, 400);
    }
  }));
});


/**
 * Load vehicle by vehicleId request param.
 */

app.param('vid', function (req, res, next, id) {
  Vehicle.findById(id, errWrap(next, function (veh) {
    if (veh) {
      req.vehicle = veh;
      util.log('vid ' + id + ' -> ' + util.inspect(veh));
      next();
    } else {
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } }, 400);
    }
  }));
});


/**
 * Load vehicle by vehicleId in integer form request param.
 */

app.param('vintid', function (req, res, next, id) {
  findVehicleByIntId(id, function (veh) {
    if (veh) {
      req.vehicle = veh;
      next();
    } else {
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } }, 400);
    }
  });
});


////////////// Web Routes

// Home

app.get('/', function (req, res) {
  res.render('index', { stateStr: '' });
});


////////////// API


// Export as CSV for webapp.

app.get('/export/:vintid/data.csv', function(req, res, next) {
  // TODO: access control.

  function numParam(name, required) {
    var v = req.query[name];
    if (!v && required)
      throw new Error('Parameter ' + name + ' is required.');
    if (!v) return null;
    var n = Number(v);
    if (isNaN(n))
      throw new Error('Parameter ' + name + ': "' + v + '" is not a number.');
    return n;
  }

  // Parameters available in query URL:
  //   beg=<beginTime>,end=<endTime> Time range to fetch.
  //   resample=<resolution> Resample data to provided duration.
  //   minDuration=<duration> Approximate minimum duration to fetch.
  //   minmax Include minimum and maximum values.
  //   chan=<name1>,chan=<name2>,... Channels to fetch.
  // There are a few special channels:
  //   $beginDate: Begin date, e.g. '2011-09-06'.
  //   $beginTime: Begin time, e.g. '16:02:23'.
  //   $beginAbsTime: Begin time in seconds since epoch, e.g. 1309914166.385.
  //   $beginRelTime: Begin time in seconds since first sample, e.g. 6.385.
  //   $endDate/$endTime/$endAbsTime/$endRelTime: End time.
  //   $duration: Duration in seconds, e.g. '0.01234'.
  // Example: curl 'http://localhost:8080/export/1772440972/data.csv?beg=1309914019674000&end=1309916383000000&chan=$beginDate&chan=$beginTime&chan=$beginAbsTime&chan=$duration&chan=$beginRelTime&chan=$endRelTime&chan=gps.speed_m_s&chan=gps.latitude_deg&chan=gps.longitude_deg&chan=gps.altitude_m&chan=accel.x_m_s2&minDuration=10000000&minmax'
  try {
    var vehicleId = req.vehicle._id;
    var resample = numParam('resample');
    var beginTime = numParam('beg', resample != null);
    var endTime = numParam('end', resample != null);
    var minDuration = numParam('minDuration');
    if (resample != null && minDuration == null)
      minDuration = Math.ceil(resample / 4);
    var getMinMax = 'minmax' in req.query;
    var channels = req.query.chan || [];
    if (_.isString(channels)) channels = [channels];
    if (!channels.length || (resample != null && resample < 1))
      return next('BAD_PARAM');  // TODO: better error
  } catch (err) {
    return next(err.toString());
  }

  res.contentType('.csv');
  var csv = CSV().toStream(res, { lineBreaks: 'windows', end: false });
  var schema = {};
  var sampleSet = {};
  var samplesSplit;
  Step(
    function fetchData() {
      var parallel = this.parallel;
      // Fetch channels.
      channels.forEach(function(channelName) {
        if (channelName[0] === '$') return;
        var next = parallel();
        var fetchOptions = {
          beginTime: beginTime, endTime: endTime,
          minDuration: minDuration, getMinMax: getMinMax
        };
        sampleDb.fetchSamples(vehicleId, channelName, fetchOptions,
                              errWrap(next, function(samples) {
          if (resample != null)
            samples = SampleDb.resample(samples, beginTime, endTime, resample);
          sampleSet[channelName] = samples;
          next();
        }));
      });
      // Fetch schema.
      { var next = parallel();
        var fetchOptions = { beginTime: beginTime, endTime: endTime };
        sampleDb.fetchSamples(vehicleId, '_schema', fetchOptions,
                              errWrap(next, function(samples) {
          samples.forEach(function(sample) {
            schema[sample.val.channelName] = sample;
          });
          next();
        }));
      }
    },

    function reorganize(err) {
      if (err)
        util.log('Error during CSV sample fetch: ' + err + '\n' + err.stack);
      samplesSplit = SampleDb.splitSamplesByTime(sampleSet);
      this();
    },

    function writeData(err) {
      if (err) return this(err);

      // Write UTF-8 signature, so that Excel imports CSV as UTF-8.
      // Unfortunately, this doesn't seem to work with all Excel versions.  Boo.
      //res.write(new Buffer([0xEF, 0xBB, 0xBF]));

      // Write header.
      var header = [];
      var specialRE = /^\$(begin|end)(Date|Time|AbsTime|RelTime)$/;
      channels.forEach(function(channelName) {
        var m = channelName.match(specialRE);
        if (m) {
          header.push(
              (m[1] === 'end' ? 'End ' : 'Begin ') +
              (m[2] === 'Date' ? 'Date' :
               m[2] === 'Time' ? 'Time' :
               m[2] === 'AbsTime' ? 'Since 1970 (s)' :
               m[2] === 'RelTime' ? 'Since Start (s)' : ''));
        } else if (channelName === '$duration') {
          header.push('Duration (s)');
        } else {
          var channelSchema = schema[channelName];
          var description = channelName;
          if (channelSchema && channelSchema.val.humanName)
            description = channelSchema.val.humanName;
          if (channelSchema && channelSchema.val.units)
            description += ' (' + channelSchema.val.units + ')';
          header.push(description);
          if (getMinMax) {
            header.push('min');
            header.push('max');
          }
        }
      });
      csv.write(header);

      // Write data.
      var firstBeg = null;
      samplesSplit.forEach(function(sampleGroup) {
        var beg = sampleGroup.beg, end = sampleGroup.end;
        if (firstBeg == null) firstBeg = beg;
        // TODO: What about time zones?
        // See zoneinfo npm and
        //   https://bitbucket.org/pellepim/jstimezonedetect/wiki/Home
        // TOOD: i18n?
        var date = new Date(beg / 1000);
        var line = [];
        channels.forEach(function(channelName) {
          var m = channelName.match(specialRE);
          if (m) {
            var t = (m[1] === 'end' ? end : beg), d = new Date(t / 1e3);
            line.push(
                m[2] === 'Date' ?
                    _.sprintf('%d-%02d-%02d',
                              d.getFullYear(), d.getMonth() + 1, d.getDate()) :
                m[2] === 'Time' ?
                    _.sprintf('%02d:%02d:%02d',
                              d.getHours(), d.getMinutes(), d.getSeconds()) :
                m[2] === 'AbsTime' ? t / 1e6 :
                m[2] === 'RelTime' ? (t - firstBeg) / 1e6 : '');
          } else if (channelName === '$duration') {
            line.push((end - beg) / 1e6);
          } else {
            var s = sampleGroup.val[channelName];
            var val = (s == null ? '' : s.val);
            if (!(_.isNumber(val) || _.isString(val)))
              val = util.inspect(val);
            line.push(val);
            if (getMinMax) {
              line.push(s == null || s.min == null ? '' : s.min);
              line.push(s == null || s.max == null ? '' : s.max);
            }
          }
        });
        csv.write(line);
      });

      csv.write([]); // Make sure there's a terminating newline.
      csv.end();
      res.end();
    },

    next
  );
});


// Pass state key to client

app.get('/vehicle', function (req, res) {
  res.redirect('/');
});

app.get('/vehicle/:id', function (req, res) {
  res.render('index', { stateStr: '' });
});

app.get('/state', function (req, res) {
  res.redirect('/');
});

app.get('/s', function (req, res) {
  res.redirect('/');
});

app.get('/state/:key', function (req, res) {
  fetchAppState(req.params.key, function (err, state) {
    var stateStr = err || !state ? '' : state.val;
    res.render('index', { stateStr: stateStr });
  });
});

app.get('/s/:key', function (req, res) {
  fetchAppState(req.params.key, function (err, state) {
    var stateStr = err || !state ? '' : state.val;
    res.render('index', { stateStr: stateStr });
  });
});


// Handle user create request

app.post('/usercreate/:newemail', function (req, res) {
  var user = new User({
      email: req.params.newemail
    , name: { full: req.body.fullName }
    , password: req.body.password
  });
  user.save(function (err) {
    if (!err) {
      res.send({ status: 'success', data: { user: user } });
      Notify.welcome(user, function (err, message) {
        if (err) {
          util.log("Error creating user '" + req.params.newemail + "': " + err);
          Notify.problem(err);
        }
      });
    } else {
      res.send({
        status: 'fail',
        data: {
          code: 'DUPLICATE_EMAIL',
          message: 'This email address is already being used on our system.',
        },
      }, 400);
    }
  });
});


// Handle vehicle create request

app.post('/vehiclecreate/:email/:make/:model/:year', function (req, res) {
  var v = new Vehicle({
      _id: parseInt(Math.random() * 0x7fffffff)  // TODO: collisions
    , make: req.params.make
    , model: req.params.model
    , year: req.params.year
    , user_id: req.currentUser._id
  });
  v.save(function (err) {
    if (!err) {
      res.send({ status: 'success', data: { vehicleId: v._id } });
    } else {
      res.send({ status: 'error', message: err }, 400);
    }
  });
});


// Handle user info request

app.get('/userinfo/:email', function (req, res) {
  res.send({ status: 'success', data: { user: req.currentUser } });
});


// Handle vehicle info request

app.get('/summary/:email/:vintid', function (req, res) {
  if (req.vehicle.user_id.toHexString() === req.currentUser._id.toHexString()) {
    jade.renderFile(path.join(__dirname, 'views', 'summary.jade'),
        { locals: { user: req.currentUser } }, function (err, body) {
      if (!err) {
        res.send(body);
      }
    });
  } else {
    res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } }, 400);
  }
});


function requestMimeType(req) {
  return (req.headers['content-type'] || '').split(';')[0];
}


// Handle sample upload request

app.put('/samples', function (req, res) {

  function fail(code) {
    util.log('PUT /samples failed: ' + code);
    res.send({ status: 'fail', data: { code: code } }, 400);
  }

  // Parse to JSON.
  var uploadSamples, mimeType = requestMimeType(req);
  if (mimeType == 'application/octet-stream') {
    var fileName = (new Date()).valueOf() + '.pbraw';
    fs.mkdir(__dirname + '/samples', '0755', function (err) {
      fs.writeFile(__dirname + '/samples/' + fileName, req.rawBody, null, function (err) {
        if (err)
          util.log(err);
        else
          util.log('Saved to: ' + __dirname + '/samples/' + fileName);
      });
    });

    uploadSamples = WebUploadSamples.parse(new Buffer(req.rawBody, 'binary'));
  } else if (mimeType == 'application/json') {
    uploadSamples = req.body;
  } else {
    fail('BAD_ENCODING:' + mimeType);
    return;
  }

  var usr, veh, fname, vehicleId = uploadSamples.vehicleId;
  var sampleSet = {};
  var firstError;
  Step(
    // get the cycle's user and authenticate
    function getUser() {
      User.findOne({ email: uploadSamples.userId }, this);
    }, function(err, usr_) {
      usr = usr_;
      if (!usr)
        fail('USER_NOT_FOUND');
      else if (!usr.authenticate(uploadSamples.password))
        fail('INCORRECT_PASSWORD');
      else
        this();
    },

    // get the cycle's vehicle
    function getVehicle() {
      findVehicleByIntId(vehicleId, this);
    }, function(veh_) {
      veh = veh_;
      if (!veh)
        fail('VEHICLE_NOT_FOUND');
      else
        this();
    },

    // save the cycle locally for now
    function(err) {
      if (err) return this(err);
      var fileName = veh.year + '.' + veh.make + '.' + veh.model + '.' +
          (new Date()).valueOf() + '.js';
      fs.mkdir(__dirname + '/samples', '0755', function (err) {
        /* Transform Buffers into arrays so they get stringified pretty. */
        var newSamples = traverse(uploadSamples).map(function(o) {
          if (_.isObject(o) && !_.isArray(o) && _.isNumber(o.length)) {
            var a = Array(o.length);
            for (var i = 0; i < o.length; ++i)
              a[i] = o[i];
            this.update(a);
          }
        });

        fs.writeFile(__dirname + '/samples/' + fileName,
                     JSON.stringify(newSamples, null, '  ') + '\n',
                     function (err) {
          if (err)
            util.log(err);
          else
            util.log('Saved to: ' + __dirname + '/samples/' + fileName);
        });
      });
      this();
    },

    // Store the data in the database.
    function(err) {
      if (err) return this(err);
      // Process samples.
      uploadSamples.sampleStream.forEach(function(sampleStream) {
        var begin = 0, duration = 0;
        sampleStream.sample.forEach(function(upSample) {
          begin += upSample.beginDelta;  // Delta decode.
          duration += upSample.durationDelta;  // Delta decode.
          var val = upSample.valueFloat;
          if (val == null) val = upSample.valueInt;
          if (val == null) val = upSample.valueString;
          if (val == null) val = upSample.valueBool;
          if (val == null) val = _.toArray(upSample.valueBytes);  // raw->Buffer
          if (val == null) {
            firstError = firstError || ('SAMPLE_NO_VALUE');
            return;
          }
          var sample = { beg: begin, end: begin + duration, val: val };
          var schema = uploadSamples.schema[upSample.schemaIndex];
          if (!schema) {
            firstError = firstError || ('SAMPLE_NO_SCHEMA_FOUND');
            return;
          }
          if (!sampleSet[schema.channelName])
            sampleSet[schema.channelName] = [sample];
          else
            sampleSet[schema.channelName].push(sample);
        });
      });

      // HACK: Heuristically add durations to zero-duration samples.
      sampleDb.addDurationHeuristicHack(vehicleId, sampleSet, 10 * SampleDb.s,
                                        this);
    },

    function(err) {
      if (err) return this(err);

      // Add schema samples.
      var schemaSamples = [];
      uploadSamples.schema.forEach(function(schema) {
        var samples = sampleSet[schema.channelName];
        // Ignore unused schemas.
        if (!samples)
          return;
        var beg =
            _.min(samples, function(sample) { return sample.beg; }).beg;
        var end =
            _.max(samples, function(sample) { return sample.end; }).end;
        schema.type = schema.type.toLowerCase();
        function transformEnumDescriptions(descriptions) {
          var r = {};
          descriptions.forEach(function(d) { r[d.value] = d.name });
          return r;
        }
        if (schema.enumVals)
          schema.enumVals = transformEnumDescriptions(schema.enumVals);
        if (schema.bitfieldBits)
          schema.bitfieldBits = transformEnumDescriptions(schema.bitfieldBits);
        schemaSamples.push({ beg: beg, end: end, val: schema });
      });
      sampleSet._schema = schemaSamples;

      // Check for errors.
      if (firstError) {
        fail(firstError);
        return;
      }

      // Insert in database.
      sampleDb.insertSamples(vehicleId, sampleSet, this);
    },

    // Any exceptions above end up here.
    function(err) {
      if (err) {
        util.log('Error while processing PUT /samples request: ' + err.stack);
        fail('INTERNAL_ERROR');
      } else {
        // Success!
        res.end();
      }
    }
  );
});


// LEGACY: Handle cycle events request

app.put('/cycle', function (req, res) {

  function fail(code) {
    util.log('PUT /cycle failed: ' + code);
    res.send({ status: 'fail', data: { code: code } }, 400);
  }

  // Parse to JSON.
  var cycle, mimeType = requestMimeType(req);
  if (mimeType == 'application/octet-stream') {
    if (!(req.body instanceof Buffer)) {
      fail('BAD_PROTOBUF_FORMAT');
      return;
    }
    cycle = EventWebUpload.parse(new Buffer(req.rawBody, 'binary'));
  } else if (mimeType == 'application/json') {
    cycle = req.body;
  } else {
    fail('BAD_ENCODING:' + mimeType);
    return;
  }

  var num = cycle.events.length, cnt = 0;

  // get the cycle's user
  User.findOne({ email: cycle.userId }, function (err, usr) {
    if (!usr) {
      fail('USER_NOT_FOUND');
      return;
    }

    // authenticate user
    if (!usr.authenticate(cycle.password)) {
      fail('INCORRECT_PASSWORD');
      return;
    }

    // get the cycle's vehicle
    findVehicleByIntId(cycle.vehicleId, function (veh) {
      if (!veh) {
        fail('VEHICLE_NOT_FOUND');
        return;
      }

      // save the cycle locally for now
      var fileName = veh.year + '.' + veh.make + '.' + veh.model + '.' +
          (veh.name ? veh.name + '.' : '') +
          (new Date()).valueOf() + '.js';
      var cycleJson = JSON.stringify(cycle);
      fs.mkdir(__dirname + '/cycles', '0755', function (err) {
        fs.writeFile(__dirname + '/cycles/' + fileName, cycleJson,
                     function (err) {
            if (err) {
              util.log(err);
            } else {
              util.log('Saved to: ' + __dirname + '/cycles/' + fileName);
            }
        });
      });

      // loop over each cycle in event
      cycle.events.forEach(function (event) {

        // add new cycle
        event.valid = true;
        event._id = new EventID({ id: veh._id, time: 0 });
        compatibility.insertEventBucket(sampleDb, event, function (err) {
          if (err)
            debug('Error in insertEventBucket: ' + err.stack);
          if (++cnt === num)
            res.end();
        });

      });
    });
  });
});


// Maintain an approximate load average for this process.
var loadAvg = 1.0;
if (getrusage) {
  var lastSampleTime, lastCpuTime;
  setInterval(function() {
    var now = Date.now();
    var cpuTime = getrusage.getcputime();
    if (lastSampleTime) {
      var delta = Math.min(1, (now - lastSampleTime) * 1e-3);
      var load = (cpuTime - lastCpuTime) / delta;
      var rc = 0.2 * delta;
      if (isNaN(loadAvg)) loadAvg = 1.0;  // Why does loadAvg occasionally become NaN?
      loadAvg = (1 - rc) * loadAvg + rc * load;
    }
    lastSampleTime = now;
    lastCpuTime = cpuTime;
  }, 500);
}


app.get('/status/load', function (req, res) {
  res.end(loadAvg + '\n');
});


// Dump a message to a log file for debugging clients.
app.post('/debug/:logFile', function (req, res) {
  if (requestMimeType(req) != 'text/plain') {
    res.statusCode = 400;
    res.end('Use content-type: text/plain');
    return;
  }
  var path = 'debug/' + req.params.logFile.replace(/\//g, '_');
  try {
    var stream = fs.createWriteStream(path, { flags: 'a', encoding: 'utf8' });
    stream.on('error', function(err) {
      util.log(req.url + ' - error writing: ' + err);
      res.statusCode = 500;
      res.end('Error writing: ' + err, 'utf8');
    });
    stream.on('close', function() { res.end() });
    req.setEncoding('utf8');
    var message = '';
    req.on('data', function(m) { message += m });
    req.on('end', function() {
      if (!/\n$/.test(message))
        message += '\n';
      stream.end(message, 'utf8');
    });
  } catch (e) {
    util.log(req.url + ' - error writing: ' + err);
    res.statusCode = 500;
    res.end('Error writing: ' + err, 'utf8');
  }
});


////////////// DNode Methods


function verifySession(user, cb) {
  if (!_.isObject(user)) {
    cb(new Error('Missing session info.'));
    return;
  }
  if (!_.isString(user.email)) {
    cb(new Error('Session missing email.'));
    return;
  }
  if (!_.isString(user.id)) {
    cb(new Error('Session missing id.'));
    return;
  }
  User.findById(user.id, function (err, usr) {
    if (err) {
      cb(new Error('User not authenticated.'));
    } else {
      cb(null, usr);
    }
  });
}


function shortInpsect(argList, maxChars) {
  var s = _.map(argList, function(arg) {
    if (_.isUndefined(arg))
      return 'undefined';
    else if (_.isFunction(arg))
      return '[Function]';
    else
      return JSON.stringify(arg);
  }).join(', ');
  if (s.length > maxChars) {
    s = s.substr(0, maxChars - 3);
    s += '...';
  }
  return s;
}

function dnodeLogMiddleware(remote, client) {
  var self = this;
  var maxArgsChars = 160, maxResultsChars = 40;
  Object.keys(self).forEach(function(fname) {
    var f = self[fname];
    if (!_.isFunction(f)) return;
    self[fname] = function() {
      var fnamePretty = '\x1b[1mdnode\x1b[0m \x1b[33m' + fname + '\x1b[0m';
      var funcArgs = _.toArray(arguments);
      var start = Date.now();
      var callback = funcArgs[funcArgs.length - 1];
      if (_.isFunction(callback)) {
        var waiting = setInterval(function() {
          util.log(fnamePretty + '(\x1b[4m' +
                   shortInpsect(funcArgs, maxArgsChars) + '\x1b[0m): ' +
                   'no callback after ' + (Date.now() - start) + ' ms!!!');
        }, 1000);
        funcArgs[funcArgs.length - 1] = function() {
          clearInterval(waiting);
          util.log(fnamePretty + '(\x1b[4m' +
                   shortInpsect(funcArgs, maxArgsChars) +
                   '\x1b[0m) -> (\x1b[4m' +
                   shortInpsect(arguments, maxResultsChars) + '\x1b[0m) ' +
                   (Date.now() - start) + ' ms');
          callback.apply(this, arguments);
        };
        f.apply(this, funcArgs);
      } else {
        var start = Date.now();
        f.apply(this, funcArgs);
        util.log(fnamePretty + '(\x1b[4m' +
                 shortInpsect(funcArgs, maxArgsChars) + '\x1b[0m) ' +
                 (Date.now() - start) + ' ms');
      }
    };
  });
}


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
  return function(f) {
    if (inFlight < maxInFlight) {
      ++inFlight;
      f(done);
    } else
      queue.push(f);
  };
}


// Every time a client connects via dnode, this function will be called, and
// the object it returns will be transferred to the client.
var createDnodeConnection = function (remote, conn) {
  var subscriptions = { };
  var user = null;  // Set once user is authenticated.

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  var sampleDbExecutionQueue = ExecutionQueue(2);

  //// Methods accessible to remote side: ////

  function signin(email, password, cb) {
    if (!email || !password) {
      cb({
        code: 'MISSING_FIELD',
        email: email || '',
        password: password || '',
        message: 'Both your email and password are required for login.'
      });
      return;
    }
    User.findOne({ email: email }, function (err, usr) {
      if (usr && usr.authenticate(password)) {
        usr.meta.logins ++;
        usr.save(function (err) {
          if (!err) {
            user = usr;
            cb(null, {
              email: usr.email,
              id: usr.id,
              first: usr.name.first,
              last: usr.name.last,
            });
          } else {
            cb({
              message: 'We\'re experiencing an unknown problem but ' +
                'are looking into it now. Please try again later.'
            });
            util.log("Error finding user '" + email + "': " + err);
          }
        });
      } else {
        cb({
          code: 'BAD_AUTH',
          email: email,
          message: 'That didn\'t work. Your email or password is incorrect.'
        });
      }
    });
  }

  function authenticate(clientUser, cb) {
    verifySession(clientUser, function (err, usr) {
      user = usr;
      cb(err);
    });
  }

  function checkAuth(cb) {
    if (!user)
      cb(new Error('Not authenticated!'));
    return user;
  }

  // TMP: use subscriptions from client end
  function fetchNotifications(opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = null;
    }
    if (!checkAuth(cb)) return;
    if (opts && opts.vehicleId) {
      fetch([ { _id: opts.vehicleId } ], false);
    } else {
      var filterUser;
      if (user.role === 'admin') {
        filterUser = null;
      } else if (user.role === 'office') {
        filterUser = ['4ddc6340f978287c5e000003',
            '4ddc84a0c2e5c2205f000001',
            '4ddee7a08fa7e041710001cb'];
      } else {
        filterUser = user;
      }
      findVehiclesByUser(filterUser, function (vehicles) {
        fetch(vehicles, true);
      });
    }

    function fetch(vehicles, addVehicle) {
      var notifications = [];
      Step(
        function () {
          var parallel = this.parallel;
          vehicles.forEach(function (v) {
            v = JSON.parse(JSON.stringify(v));  // Strip mongoose crap.
            var next = parallel();
            Step(
              function () {
                sampleDb.fetchSamples(v._id, '_drive', {}, this.parallel());
                sampleDb.fetchSamples(v._id, '_charge', {}, this.parallel());
                sampleDb.fetchSamples(v._id, '_error', {}, this.parallel());
                sampleDb.fetchSamples(v._id, '_warning', {}, this.parallel());
                sampleDb.fetchSamples(v._id, '_note', {}, this.parallel());
              },
              function (err, drives, charges, errors, warnings, note) {
                if (err) { cb(err); return; }
                function addType(type) {
                  return function(not) {
                    not.type = type;
                    if (addVehicle) not.vehicle = v;
                  }
                }
                drives.forEach(addType('_drive'));
                charges.forEach(addType('_charge'));
                errors.forEach(addType('_error'));
                warnings.forEach(addType('_warning'));
                note.forEach(addType('_note'));
                notifications =
                    notifications.concat(drives, charges, errors, warnings, note);
                next();
              }
            );
          });
          parallel()(); // In case there are no vehicles.
        },
        function (err) {
          if (err) { cb(err); return; }
          // SampleDb.sortSamplesByTime(notifications, true);
          // HACK: notes require special sorting.
          notifications.sort(function(a, b) {
            var at = a.val.date ? a.val.date * 1e3 : a.beg;
            var bt = b.val.date ? b.val.date * 1e3 : b.beg;
            return bt - at;
          });
          cb(null, notifications);
        }
      );
    }
  }

  function fetchVehicles(cb) {
    if (!checkAuth(cb)) return;
    var filterUser;
    if (user.role === 'admin') {
      filterUser = null;
    } else if (user.role === 'office') {
      filterUser = ['4ddc6340f978287c5e000003',
          '4ddc84a0c2e5c2205f000001',
          '4ddee7a08fa7e041710001cb'];
    } else {
      filterUser = user;
    }
    findVehiclesByUser(filterUser, function (vehicles) {
      Step(
        // Add lastSeen to all vehicles in parallel.
        function () {
          var parallel = this.parallel;
          vehicles.forEach(function (v) {
            var next = parallel();
            sampleDb.fetchSamples(v._id, '_wake', {}, function(err, cycles) {
              if (cycles && cycles.length > 0) {
                v.lastCycle = _.last(cycles);
                v.lastSeen = v.lastCycle.end;
              }
              User.findById(v.user_id, function (err, usr) {
                if (usr)
                  v.user = usr;
                next();
              });
            });
          });
          parallel()(); // In case there are no vehicles.
        }, function (err) {
          if (err) { this(err); return; }

          // SP: ugly - mongoose's weird doc mapping
          // makes it hard to inject new props, like lastSeen.
          var vehs = vehicles.map(function (vehicle) {
            var v = vehicle._doc;
            v.user = vehicle.user;
            v.lastSeen = vehicle.lastSeen || 0;
            if (vehicle.lastCycle) v.lastCycle = vehicle.lastCycle;
            return v;
          });

          // Only keep vehicles which have drive cycles.
          // vehs = vehs.filter(function (v) {
          //   return v.lastSeen !== null;
          // });

          // Sort by lastSeen.
          vehs.sort(function (a, b) {
            return b.lastSeen - a.lastSeen;
          });

          vehs.splice(20);  // HACK: Thow away all but first 20 vehicles.
          // HACK: mongoose litters its results with __proto__ fields and
          // _id with types that confuse dnode.  Go through JSON to get
          // plain old data.
          cb(null, JSON.parse(JSON.stringify(vehs)));
        }
      );
    });
  }

  function fetchUsers(cb) {
    if (!checkAuth(cb)) return;
    User.find().sort('created', -1).run(function (err, usrs) {
      if (!err) {
        cb(null, JSON.parse(JSON.stringify(usrs)));
      } else {
        cb(null, []);
      }
    });
  }

  // Fetch samples.
  // TODO: get rid of subscriptions, replace with 'wait until data available'
  // option.
  function fetchSamples(vehicleId, channelName, options, cb) {
    if (!checkAuth(cb)) return;
    sampleDbExecutionQueue(function(done) {
      var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
      console.time(id);
      function next(err, samples) {
        console.timeEnd(id);
        cb(err, samples);
        // TODO: subscriptions broken with execution queue.
        done();
      };
      if (options.subscribe != null) {
        var handle = options.subscribe;
        console.log(handle);
        options.subscribe = 0.25;  // Polling interval, seconds.
        cancelSubscribeSamples(handle);
        subscriptions[handle] =
            sampleDb.fetchSamples(vehicleId, channelName, options, next);
      } else {
        sampleDb.fetchSamples(vehicleId, channelName, options, next);
      }
    });
  }

  function cancelSubscribeSamples(handle, cb) {
    // No need to check auth.
    if (handle != null && subscriptions[handle]) {
      sampleDb.cancelSubscription(subscriptions[handle]);
      delete subscriptions[handle];
    }
    if (cb) cb();
  }

  /**
   * Insert samples.
   *
   *   sampleSet = {
   *     <channelName>: [ samples ],
   *     ...
   *   }
   */
  function insertSamples(vehicleId, sampleSet, options, cb) {
    if (_.isFunction(options) && cb == null) {
      cb = options;
      options = {};
    }
    if (!checkAuth(cb)) return;
    sampleDb.insertSamples(vehicleId, sampleSet, options, cb);
  }

  // Fetch channel tree.
  // TODO: move this into client code, use _schema subscription instead.
  function fetchChannelTree(vehicleId, cb) {
    if (!checkAuth(cb)) return;
    sampleDb.fetchSamples(vehicleId, '_schema', {},
                          errWrap(cb, function (samples) {
      cb(null, SampleDb.buildChannelTree(samples));
    }));
  }

  function fetchVehicleConfig(vehicleId, cb) {
    if (!checkAuth(cb)) return;
    var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
    var templateFilePath = __dirname + '/public/vconfig/template.xml';
    fs.readFile(idFilePath, 'utf8',
        function (err, data) {
      if (err) {
        fs.readFile(templateFilePath, 'utf8',
            function (err, data) {
          data = data.replace(/\[vid\]/, vehicleId);
          fs.writeFile(idFilePath, data, function (err) {
            util.log("XML Configuration File CREATED for Vehicle " + vehicleId);
            cb(err, data);
          });
        });
      } else {
        cb(err, data);
      }
    });
  }

  function saveVehicleConfig(vehicleId, data, cb) {
    if (!checkAuth(cb)) return;
    var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
    var generation = data.match(/<config generation="([0-9]*)">/);
    if (generation && generation[1] !== "") {
      var genNum = parseInt(generation[1]);
      data = data.replace('<config generation="' + genNum + '">',
                          '<config generation="' + (genNum + 1) + '">');
    }
    fs.writeFile(idFilePath, data, function (err) {
      util.log("XML Configuration File SAVED for Vehicle " + vehicleId);
      cb(err, data);
    });
  }

  function saveAppState(data, cb) {
    if (!checkAuth(cb)) return;
    var state = new AppState({ val: data });
    state.save(function (err) {
      cb(err, state.key);
    });
  }

  conn.on('end', function () {
    _.keys(subscriptions).forEach(cancelSubscribeSamples);
  });

  return {
    signin: signin,
    authenticate: authenticate,
    fetchNotifications: fetchNotifications,
    fetchVehicles: fetchVehicles,
    fetchUsers: fetchUsers,
    fetchSamples: fetchSamples,
    cancelSubscribeSamples: cancelSubscribeSamples,
    insertSamples: insertSamples,
    fetchChannelTree: fetchChannelTree,
    fetchVehicleConfig: fetchVehicleConfig,
    saveVehicleConfig: saveVehicleConfig,
    saveAppState: saveAppState,
  };
};

////////////// Initialize and Listen

var sampleDb;

if (!module.parent) {
  Step(
    // Connect to SampleDb:
    function() {
      util.log('Connecting to SampleDb: ' + argv.db);
      mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
    }, function(err, db) {
      if (err) { this(err); return; }
      new SampleDb(db, { ensureIndexes: true }, this);
    }, function(err, newSampleDb) {
      if (err) { this(err); return; }
      sampleDb = newSampleDb;
      this();
    },

    // Listen:
    function(err) {
      if (err) { this(err); return; }
      app.listen(argv.port);

      dnode(createDnodeConnection).use(dnodeLogMiddleware).
          listen(app, {
              io: { 'log level': 2,
                    transports: [
                      'websocket',
                      //'htmlfile',  // doesn't work
                      'xhr-polling',
                      //'jsonp-polling',  // doesn't work
                    ] }
          } );
      util.log("Express server listening on port " + app.address().port);
    }
  );
}
