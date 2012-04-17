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
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

/**
 * Module dependencies.
 */
var log = require('./log.js').log;
var logTimestamp = require('./log.js').logTimestamp;
var express = require('express');
var connect = require('connect');
var jade = require('jade');
var mongodb = require('mongodb');
var mongoStore = require('connect-mongodb');
var gzip = require('connect-gzip');
var dnode = require('dnode');
var color = require('cli-color');
var fs = require('fs');
var path = require('path');
var CSV = require('csv');
var traverse = require('traverse');
var util = require('util'), inspect = util.inspect;
var url = require('url');
var zlib = require('zlib');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var Buffers = require('buffers');
var EventDescFileName = __dirname +
    '/../mission-java/common/src/main/protobuf/Events.desc';
var WebUploadSamples, EventWebUpload;
try {
  var ProtobufSchema = require('protobuf_for_node').Schema;
  var Event = new ProtobufSchema(fs.readFileSync(EventDescFileName));
  WebUploadSamples = Event['event.WebUploadSamples'];
  EventWebUpload = Event['event.EventWebUpload'];
} catch (e) {
  log('Could not load proto buf ' + EventDescFileName +
      ', upload APIs won\'t work!');
  log(e.stack || e);
}
var getrusage;
try {
  getrusage = require('getrusage');
} catch (e) {
  log('Could not load getrusage module, try: node_modules/build.sh');
  log(e.stack || e);
}
var Notify = require('./notify');

var UserDb = require('./user_db.js').UserDb;
var SampleDb = require('./sample_db.js').SampleDb;

var compatibility = require('./compatibility.js');

var pubsub = require('./minpubsub');
var jadeify = require('jadeify');

var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var LocalStrategy = require('passport-local').Strategy;


/////////////// Helpers

/**
 * Wraps a callback f to simplify error handling.  Specifically, this:
 *   asyncFunction(..., errWrap(cb, function (arg) {
 *     ...
 *     cb(...);
 *   }));
 * is equivalent to:
 *   asyncFunction(..., function (err, arg) {
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
  return function (err) {
    if (err) { next(err); return; }
    try {
      f.apply(this, Array.prototype.slice.call(arguments, 1));
    } catch (err) {
      next(err);
    }
  }
}

function requestMimeType(req) {
  return (req.headers['content-type'] || '').split(';')[0];
}

/////////////// Configuration

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
  return function (req, res, next) {
    if ('GET' == req.method || 'HEAD' == req.method) return next();
    var mimeType = (req.headers['content-type'] || '').split(';')[0];
    if (_.contains(rawMimeTypes, mimeType)
        && (!req.body || _.isEmpty(req.body))) {
      // req.setEncoding(null);
      var bufs = Buffers();
      req.on('data', function (chunk) { bufs.push(chunk); });
      req.on('end', function () {
        req.rawBody = bufs.toBuffer();
        next();
      });
    } else {
      next();
    }
  }
}

app.set('sessionStore', new mongoStore({
  db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
}, function (err) {
  if (err) log('Error creating mongoStore: ' + err);
}));

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
  app.use(rawBody(['application/octet-stream', 'application/x-gzip']));
  app.use(express.cookieParser());
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one week
    secret: 'hum7a5t1c',
    store: app.settings.sessionStore,
  }));
  app.use(express.session.ignore.push('/status/load'));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.logger({ format: function (tok, req, res) {
    var url = tok.url(req, res) || '-';
    if (/^\/status/.test(url)) return;
    return logTimestamp() + ' ' + color.red(tok.method(req, res) || '-') + ' ' +
        color.yellow(tok.url(req, res) || '-') + ' ' +
        tok['response-time'](req, res) + ' ms';
  }}));

  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  var start = Date.now();
  app.use(require('browserify')({
    require : [ 'dnode', 'underscore', 'step', './minpubsub',
        './shared_utils', './units.js' ],
  }).use(jadeify(__dirname + '/public/javascripts/templates')));
  log('browserify took: ' + (Date.now() - start) + 'ms.');
});

// Passport session cruft

passport.serializeUser(function (user, cb) {
  cb(null, user._id.toString());
});

passport.deserializeUser(function (id, cb) {
  userDb.findUserById(id, function (err, user) {
    if (!user) user = {};
    cb(err, user);
  });
});

passport.use(new LocalStrategy(
  function (email, password, done) {
    userDb.collections.users.findOne({ primaryEmail: email },
                                    function (err, user) {
      if (err) return done(err);
      if (!user) return done(null, false);
      if ('local' !== user.provider)
        return done(null, false);
      if (!UserDb.authenticateLocalUser(user, password))
        return done(null, false);
      return done(null, user);
    });
  }
));

// Set up Google login strategy.
// Horrible hack: we don't know the right URLs to use until we see a request,
// so fill them in with dummy values for now, and fill them in for real
// in app.get('/auth/google', ...).
passport.use(new GoogleStrategy(
  { returnURL: 'http://www.google.com/#q=Why+is+skyline+banned', realm: null },
  function (identifier, profile, done) {
    profile.provider = 'google';
    userDb.findOrCreateUserFromPrimaryEmail(profile, function (err, user) {
      done(err, user);
    });
  }
));


////////////// Web Routes

// Home
app.get('/', function (req, res) {
  res.render('index');
});

// Basic password authentication
app.post('/login', function (req, res, next) {
  var referer = req.headers.referer;
  passport.authenticate('local', {
    successRedirect: referer,
    failureRedirect: referer + '#oops'
  })(req, res, next);
});


// Redirect the user to Google for authentication.
// When complete, Google will redirect the user
// back to the application at /auth/google/return.
app.get('/auth/google', function (req, res, next) {
  // Add referer to session so we can use it on return.
  // This way we can preserve query params in links.
  req.session.referer = req.headers.referer;

  // Hack: fill in returnUrl and realm for google auth.
  var myUrl = url.parse(req.headers.referer);
  myUrl.search = myUrl.query = myUrl.hash = null;
  myUrl.pathname = '/auth/google/return';
  var returnUrl = url.format(myUrl);
  myUrl.pathname = '/';
  var realm = url.format(myUrl);
  log('passport: ' + inspect(passport));
  log("passport._strategies['google']: " +
      inspect(passport._strategies['google']));
  log('returnUrl: ' + returnUrl);
  log('realm: ' + realm);
  passport._strategies['google']._relyingParty.returnUrl = returnUrl;
  passport._strategies['google']._relyingParty.realm = realm;
  log('passport: ' + inspect(passport));
  log("passport._strategies['google']: " +
      inspect(passport._strategies['google']));

  passport.authenticate('google')(req, res, next);
});


// Google will redirect the user to this URL
// after authentication. Finish the process by
// verifying the assertion. If valid, the user will be
// logged in. Otherwise, authentication has failed.
app.get('/auth/google/return', function (req, res, next) {
  passport.authenticate('google', {
    successRedirect: req.session.referer || '/',
    failureRedirect: req.session.referer || '/'
  })(req, res, next);
});

// We logout via an ajax request.
app.get('/logout', function (req, res) {
  req.logOut();
  res.redirect('/');
});

// Go home
app.get('/vehicle', function (req, res) {
  res.redirect('/');
});

// Allows sharing by vehicle
app.get('/vehicle/:id', function (req, res) {
  res.render('index');
});

// Go home
app.get('/s', function (req, res) {
  res.redirect('/');
});

// Alias to above
app.get('/s/:key', function (req, res) {
  userDb.collections.links.findOne({ key: req.params.key },
                                  function (err, link) {
    res.redirect('/?' + (err || !link ? '' : link.val));
  });
});


////////////// API


// Export as CSV for webapp.
app.get('/export/:vintid/data.csv', function (req, res, next) {
  // TODO: access control.
  // TODO: verify vehicle.

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
    var vehicleId = Number(req.params.vintid);
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
      channels.forEach(function (channelName) {
        if (channelName[0] === '$') return;
        var next = parallel();
        var fetchOptions = {
          beginTime: beginTime, endTime: endTime,
          minDuration: minDuration, getMinMax: getMinMax
        };
        sampleDb.fetchSamples(vehicleId, channelName, fetchOptions,
                              errWrap(next, function (samples) {
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
                              errWrap(next, function (samples) {
          samples.forEach(function (sample) {
            schema[sample.val.channelName] = sample;
          });
          next();
        }));
      }
    },

    function reorganize(err) {
      if (err)
        log('Error during CSV sample fetch: ' + err + '\n' + err.stack);
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
      channels.forEach(function (channelName) {
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
      samplesSplit.forEach(function (sampleGroup) {
        var beg = sampleGroup.beg, end = sampleGroup.end;
        if (firstBeg == null) firstBeg = beg;
        // TODO: What about time zones?
        // See zoneinfo npm and
        //   https://bitbucket.org/pellepim/jstimezonedetect/wiki/Home
        // TOOD: i18n?
        var date = new Date(beg / 1000);
        var line = [];
        channels.forEach(function (channelName) {
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


// Create a user
app.post('/create/user/:email', function (req, res) {
  var props = {
    primaryEmail: req.params.email,
    emails: [ { value: req.params.email } ],
    displayName: req.body.fullName,
    password: req.body.password,
    provider: 'local',
  };
  userDb.findOrCreateUserFromPrimaryEmail(props, function (err, user) {
    if (err) return res.send({ status: 'error', message: err }, 400);
    res.send({ status: 'success', data: user });
  });
});


// Create a vehicle
// ** In practice, this route is only ever
// used by a new client, e.g., a tablet,
// when it's initializing itself. We pass
// back a unique vehicleId to use when uploading
// samples for a specific vehicle in our database
// and a clientId that the the server can use
// for authentication.
app.post('/create/vehicle/:title/:description/:nickname',
    function (req, res) {
  var props = {
    title: req.params.title,
    description: req.params.description,
    nickname: req.params.nickname,
  };
  userDb.createVehicle(props, function (err, veh) {
    if (err)
      res.send({ status: 'error', message: err }, 400);
    else
      res.send({ status: 'success', data: {
              vehicleId: veh._id, clientId: veh.clientId } });
  });
});

// Create a team
app.post('/create/team/:title/:description/:nickname/:domains/:users/:admins',
    function (req, res) {
  var props = {
    title: req.params.title,
    description: req.params.description,
    nickname: req.params.nickname,
    domains: req.params.domains !== 'null' ?
        req.params.domains.split(',') : [],
    users: req.params.users !== 'null' ?
        _.map(req.params.users.split(','),
              function (v) { return Number(v); }) : [],
    admins: req.params.admins !== 'null' ?
        _.map(req.params.admins.split(','),
              function (v) { return Number(v); }) : [],
    vehicles: [],
    fleets: [],
  };
  userDb.createTeam(props, function (err, team) {
    if (err)
      res.send({ status: 'error', message: err }, 400);
    else
      res.send({ status: 'success', data: { teamId: team._id } });
  });
});

// Create a fleet
app.post('/create/fleet/:title/:description/:nickname/:vehicles',
    function (req, res) {
  var props = {
    title: req.params.title,
    description: req.params.description,
    nickname: req.params.nickname,
    vehicles: req.params.vehicles !== 'null' ?
        _.map(req.params.vehicles.split(','),
              function (v) { return Number(v); }) : [],
  };
  userDb.createFleet(props, function (err, fle) {
    if (err)
      res.send({ status: 'error', message: err }, 400);
    else
      res.send({ status: 'success', data: { fleetId: fle._id } });
  });
});

// Handle sample upload request
app.put('/samples', function (req, res) {

  // Parse to JSON.
  var uploadSamples;

  var usr, veh, fname, vehicleId;
  var sampleSet = {};
  var firstError;
  Step(
    function parseSamples() {
      var mimeType = requestMimeType(req);
      if (mimeType == 'application/x-gzip') {
        var fileName = (new Date()).valueOf() + '.pbraw.gz';
        fs.mkdir(__dirname + '/samples', '0755', function (err) {
          fs.writeFile(__dirname + '/samples/' + fileName,
                      req.rawBody, null, function (err) {
            if (err) log(err);
            else
              log('Saved to: ' + __dirname + '/samples/' + fileName);
          });
        });

        var next = this;
        Step(
          function() {
            zlib.unzip(new Buffer(req.rawBody, 'binary'), this);
          }, function(err, unzipped) {
            if (err) {
              this(err);
            } else {
              uploadSamples = WebUploadSamples.parse(unzipped);
              this();
            }
          }, next
        );
      } else if (mimeType == 'application/octet-stream') {
        var fileName = (new Date()).valueOf() + '.pbraw';
        fs.mkdir(__dirname + '/samples', '0755', function (err) {
          fs.writeFile(__dirname + '/samples/' + fileName,
                      req.rawBody, null, function (err) {
            if (err) log(err);
            else
              log('Saved to: ' + __dirname + '/samples/' + fileName);
          });
        });

        uploadSamples =
            WebUploadSamples.parse(new Buffer(req.rawBody, 'binary'));
        this();
      } else if (mimeType == 'application/json') {
        uploadSamples = req.body;
        this();
      } else {
        throw ('BAD_ENCODING:' + mimeType);
      }
    },

    //// TODO: Integrate some kind of authentication.
    //// Public-key cryptography ?
    // get the cycle's user and authenticate ** LAGACY **
    // function getUser() {
    //   User.findOne({ email: uploadSamples.userId }, this);
    // }, function (err, usr_) {
    //   usr = usr_;
    //   if (!usr)
    //     fail('USER_NOT_FOUND');
    //   else if (!usr.authenticate(uploadSamples.password))
    //     fail('INCORRECT_PASSWORD');
    //   else
    //     this();
    // },
    // get the cycle's vehicle
    function getVehicle(err) {
      if (err) return this(err);
      vehicleId = uploadSamples.vehicleId;
      userDb.collections.vehicles.findOne({ _id: vehicleId }, this);
    }, function (err, veh_) {
      if (err) return this(err);
      veh = veh_;
      if (!veh)
        throw 'VEHICLE_NOT_FOUND';
      else
        this();
    },
    // save the cycle locally for now
    function (err) {
      if (err) return this(err);
      var fileName = vehicleId + '_' + (new Date()).valueOf() + '.js';
      fs.mkdir(__dirname + '/samples', '0755', function (err) {
        /* Transform Buffers into arrays so they get stringified pretty. */
        var newSamples = traverse(uploadSamples).map(function (o) {
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
            log(err);
          else
            log('Saved to: ' + __dirname + '/samples/' + fileName);
        });
      });
      this();
    },

    // Store the data in the database.
    function (err) {
      if (err) return this(err);
      // Process samples.
      uploadSamples.sampleStream.forEach(function (sampleStream) {
        var begin = 0, duration = 0;
        sampleStream.sample.forEach(function (upSample) {
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

      if (!(uploadSamples.protocolVersion >= 2)) {
        // HACK: Heuristically add durations to zero-duration samples.
        sampleDb.addDurationHeuristicHack(vehicleId, sampleSet,
                                          10 * SampleDb.s, this);
      }
    },

    function (err) {
      if (err) return this(err);

      // Add schema samples.
      var schemaSamples = [];
      uploadSamples.schema.forEach(function (schema) {
        var samples = sampleSet[schema.channelName];
        // Ignore unused schemas.
        if (!samples)
          return;
        var beg =
            _.min(samples, function (sample) { return sample.beg; }).beg;
        var end =
            _.max(samples, function (sample) { return sample.end; }).end;
        schema.type = schema.type.toLowerCase();
        function transformEnumDescriptions(descriptions) {
          var r = {};
          descriptions.forEach(function (d) { r[d.value] = d.name });
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
        throw firstError;
        return;
      }

      // Insert in database.
      sampleDb.insertSamples(vehicleId, sampleSet, this);
    },

    // Any exceptions above end up here.
    function (err) {
      if (err) {
        log('Error while processing PUT /samples request: ' +
            (err.stack || err));
        res.send({ status: 'fail', data: { code: (err.stack || err) } }, 400);
      } else {
        // Success!
        res.end();
      }
    }
  );
});

// Maintain an approximate load average for this process.
var loadAvg = 1.0;
if (getrusage) {
  var lastSampleTime, lastCpuTime;
  setInterval(function () {
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

// Get load average
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
    stream.on('error', function (err) {
      log(req.url + ' - error writing: ' + err);
      res.statusCode = 500;
      res.end('Error writing: ' + err, 'utf8');
    });
    stream.on('close', function () { res.end() });
    req.setEncoding('utf8');
    var message = '';
    req.on('data', function (m) { message += m });
    req.on('end', function () {
      if (!/\n$/.test(message))
        message += '\n';
      stream.end(message, 'utf8');
    });
  } catch (e) {
    log(req.url + ' - error writing: ' + err);
    res.statusCode = 500;
    res.end('Error writing: ' + err, 'utf8');
  }
});


////////////// LEGACY

function legacy(req, res) {
  log('LEGACY ROUTE: ' + req.route.path);
  res.send({ status: 'fail',
          data: { code: 'ROUTE IS DEPRECATED' } }, 400);
}

// User create
// ** Users are now created through Passport and UserDb.
app.post('/usercreate/:newemail', legacy);

// Vehicle create
// ** Make, model and year are no longer relevant.
// Replaced with /create/vehicle above.
app.post('/vehiclecreate/:email/:make/:model/:year', legacy);

// User info
// ** Used by Henson but since telemetry devices
// (tablets) are no longer associated with users and
// we no longer find users by email, this is useless.
// Not replaced.
app.get('/userinfo/:email', legacy);

// Vehicle info
// ** Used by Henson but since telemetry devices
// (tablets) are no longer associated with users,
// this does not make sense.
// Not replaced.
app.get('/summary/:email/:vintid', legacy);

// Dump cycles
// ** Replaced by /samples above.
app.put('/cycle', legacy);


////////////// DNode Methods

function shortInpsect(argList, maxChars) {
  var s = _.map(argList, function (arg) {
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
  Object.keys(self).forEach(function (fname) {
    var f = self[fname];
    if (!_.isFunction(f)) return;
    self[fname] = function () {
      var fnamePretty = color.red('dnode') + ' ' + color.yellow(fname);
      var funcArgs = _.toArray(arguments);
      var start = Date.now();
      var callback = funcArgs[funcArgs.length - 1];
      if (_.isFunction(callback)) {
        var waiting = setInterval(function () {
          log(fnamePretty + '(' +
              color.underline(shortInpsect(funcArgs, maxArgsChars)) +
              '): no callback after', Date.now() - start, 'ms!!!');
        }, 1000);
        funcArgs[funcArgs.length - 1] = function () {
          clearInterval(waiting);
          log(fnamePretty + '(' +
              color.underline(shortInpsect(funcArgs, maxArgsChars)) +
              ') -> (' +
              color.underline(shortInpsect(arguments, maxResultsChars)) +
              ')', Date.now() - start, 'ms');
          callback.apply(this, arguments);
        };
        f.apply(this, funcArgs);
      } else {
        var start = Date.now();
        f.apply(this, funcArgs);
        log(fnamePretty + '(' +
            color.underline(shortInpsect(funcArgs, maxArgsChars)) + ')',
            Date.now() - start, 'ms');
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
  return function (f) {
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

  // This will be the initial http request seen by connect.
  var req;

  // Handles currently being delivered to client (vehicleId, channelName).
  var subscriptions = {};

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  var sampleDbExecutionQueue = ExecutionQueue(2);

  conn.on('ready', function () {
    var sockId = conn.stream.socketio.id;
    req = conn.stream.socketio.manager.handshaken[sockId];
  });

  conn.on('end', function () {
    _.keys(subscriptions).forEach(cancelSubscribeSamples);
  });

  function authorize(cb) {
    // If we've gotten this far, the session
    // is valid and has already been fetched.
    // Now we see if there's a user attached.
    var userId = req.session.passport.user;
    if (userId) {
      userDb.findUserById(userId, function (err, user) {
        if (err) return cb(err.toString());
        if (!user)
          return cb('User and Session do NOT match!');
        delete user.password;
        delete user.salt;
        delete user.pin;
        userDb.getUserVehicleData(user, function (err, data) {
          if (err) return cb(err.toString());
          delete user.vehicles;
          delete user.fleets;
          user.data = {
            teams: data.teams,
            fleets: data.fleets,
          };
          req.user = user;
          req.user.data.vehicles = data.vehicles;
          cb(null, user);
        });
      });
    } else cb('Session has no User.');
  }

  /*
   * Wrapper for remote accesible methods.
   * Flags is a list if specific access keys
   * to enforce.
   */
  function ensureAuth(f, flags) {
    return function () {
      var args = _.toArray(arguments);
      var vid = _.first(args);
      var cb = _.last(args);
      if (!UserDb.haveAccess(vid, req.user.data.vehicles, flags))
        return cb('Permission denied.');
      else f.apply(null, args);
    };
  }

  //// Fetch colletion methods ////
  // Since these are read methods and
  // we maintain a copy of the user's 
  // data server-side that was created against
  // their access lists, we do not need to re-auth
  // on those specific vehicles unless we're fetching
  // events for a specific client-side defined vehicle.

  function fetchVehicles(cb) {
    if (req.user.data.vehicles.length === 0)
      return cb(null, []);
    var _done = _.after(req.user.data.vehicles.length, done);
    _.each(req.user.data.vehicles, function (veh) {
      sampleDb.fetchSamples(veh._id, '_wake', {},
                            function (err, cycles) {
        if (err) return cb(err);
        if (cycles && cycles.length > 0)
          veh.lastCycle = _.last(cycles);
        else veh.lastCycle = { beg: 0, end: 0 };
        _done();
      });
    });

    function done() {
      cb(null, req.user.data.vehicles.sort(function (a, b) {
        return b.lastCycle.end - a.lastCycle.end;
      }));
    }
  }

  function fetchEvents(opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = null;
    }
    var vehicles;
    if (opts && opts.vehicleId) {
      if (UserDb.haveAccess(opts.vehicleId, req.user.data.vehicles))
        vehicles = [{ _id: opts.vehicleId }];
      else return cb('Permission denied.');
    } else vehicles = req.user.data.vehicles;
    var drives = [];
    var charges = [];
    var errors = [];
    var warnings = []; 
    var notes = [];
    Step(
      function () {
        if (vehicles.length > 0) {
          var _this = _.after(vehicles.length, this);
          _.each(vehicles, function (veh) {
            Step(
              function () {
                sampleDb.fetchSamples(veh._id, '_drive', {}, this.parallel());
                sampleDb.fetchSamples(veh._id, '_charge', {}, this.parallel());
                sampleDb.fetchSamples(veh._id, '_error', {}, this.parallel());
                sampleDb.fetchSamples(veh._id, '_warning', {}, this.parallel());
                sampleDb.fetchSamples(veh._id, '_note', {}, this.parallel());
              },
              function (err, _drives, _charges, _errors, _warnings, _notes) {
                if (err) return cb(err);
                function addType(type) {
                  return function (not) {
                    not.type = type;
                    if (!(opts && opts.vehicleId))
                      not.vehicle = veh;
                  }
                }
                _.each(_drives, addType('_drive'));
                _.each(_charges, addType('_charge'));
                _.each(_errors, addType('_error'));
                _.each(_warnings, addType('_warning'));
                _.each(_notes, addType('_note'));
                drives = drives.concat(_drives);
                charges = charges.concat(_charges);
                errors = errors.concat(_errors);
                warnings = warnings.concat(_warnings);
                notes = notes.concat(_notes);
                _this();
              }
            );
          });
        } else this();
      },
      function (err) {
        if (err) return cb(err);
        var _sort = _.after(notes.length, sort);
        _.each(notes, function (note) {
          userDb.findUserById(note.val.userId, function (err, usr) {
            if (err) return cb(err);
            delete usr.password;
            delete usr.salt;
            delete usr.pin;
            delete usr.vehicles;
            delete usr.fleets;
            note.user = usr;
            _sort();
          });
        });
        function sort() {
          var bins = {};
          var threads = [];
          var threadedNotes = [];
          _.each(notes, function (note) {
            var key = String(note.beg) + String(note.end);
            if (!(key in bins)) bins[key] = [];
            bins[key].push(note);
          });
          _.each(bins, function (bin) {
            threads.push(bin);
          });
          _.each(threads, function (thread) {
            thread.sort(function (a, b) {
              return a.val.date - b.val.date;
            });
            var note = thread[0];
            note.replies = _.rest(thread);
            note.latest = _.last(thread).val.date;
            threadedNotes.push(note);
          });
          var notifications = [].concat(drives, charges, errors,
                                        warnings, threadedNotes);
          notifications.sort(function (a, b) {
            var at = a.latest ? a.latest * 1e3 : a.beg;
            var bt = b.latest ? b.latest * 1e3 : b.beg;
            return bt - at;
          });
          cb(null, notifications);
        }
      }
    );
  }

  function fetchFinderTree(type, cb) {
    switch (type) {
      case 'users':
        // ensureAdmin(_.bind(fetchUserTree, this, cb));
        fetchUserTree(cb);
        break;
      case 'vehicles':
        fetchVehicleTree(cb);
        break;
      case 'teams':
        fetchTeamTree(cb);
        break;
      case 'fleets':
        fetchFleetTree(cb);
        break;
    }
  } 

  function fetchUserTree(cb) {
    var self = this;
    var accessList;
    var tree = [];
    Step(
      function () {
        userDb.getAccessList(this.parallel());
        userDb.collections.users.find({}).toArray(this.parallel());
      },
      function (err, list, users) {
        if (err) return cb(err);
        var next = this;
        accessList = list;
        if (users.length === 0)
          return cb(null, []);


        var _next = _.after(users.length, next);
        _.each(users, function (user) {
          user.type = 'users';
          var access = _.filter(accessList, function (acc) {
            return acc.granteeType === 'users'
                   && acc.granteeId === user._id;
          });
          tree.push(user);
          if (access.length === 0)
            return _next();
          user.sub = [];
          var __next = _.after(access.length, _next);
          _.each(access, function (acc) {
            userDb.collections[acc.targetType].findOne({ _id: acc.targetId },
                                                        function (err, doc) {
              if (err) return cb(err);
              doc.type = acc.targetType;
              user.sub.push(doc);
              __next();
            });
          });
        });
      },
      function (err) {
        if (err) return cb(err);
        cb(null, tree);
      }
    );
  }

  function fetchVehicleTree(cb) {
    if (req.user.data.vehicles.length === 0)
      return cb(null, []);
    var accessList;
    var tree = [];
    Step(
      function () {
        userDb.getAccessList(this);
      },
      function (err, list) {
        if (err) return cb(err);
        var next = this;
        accessList = list;
        var _next = _.after(req.user.data.vehicles.length, next);
        _.each(req.user.data.vehicles, function (veh) {
          var veh = _.clone(veh);
          veh.type = 'vehicles';
          var access = _.filter(accessList, function (acc) {
            return acc.targetType === 'vehicles'
                   && acc.targetId === veh._id;
          });
          tree.push(veh);
          if (access.length === 0)
            return _next();
          veh.sub = [];
          var __next = _.after(access.length, _next);
          _.each(access, function (acc) {
            userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
                                                        function (err, doc) {
              if (err) return cb(err);
              doc.type = acc.granteeType;
              delete doc.vehicles;
              delete doc.fleets;
              // TODO: get team members, admins, domains
              // add them to the team's sub.
              veh.sub.push(doc);
              __next();
            });
          });
        });
      },
      function (err) {
        if (err) return cb(err);
        var next = this;
        var matchedFleets = [];
        userDb.collections.fleets.find({}).toArray(function (err, fleets) {
          if (err) return cb(err);
          var _next = _.after(fleets.length, next);
          _.each(fleets, function (fleet) {
            _.each(tree, function (veh) {
              var match = _.find(fleet.vehicles, function (id) {
                                return id === veh._id; });
              if (match) {
                fleet.type = 'fleets';
                if (!veh.sub) veh.sub = [];
                veh.sub.push(fleet);
                if (!_.find(matchedFleets, function (f) {
                      return f._id === fleet._id; }))
                  matchedFleets.push(fleet);
              }
            });
            _next(null, matchedFleets);
          });
        });
      },
      function (err, fleets) {
        if (err) return cb(err);
        var next = this;
        if (fleets.length === 0)
          return next();
        var _next = _.after(fleets.length, next);
        _.each(fleets, function (fleet) {
          var access = _.filter(accessList, function (acc) {
            return acc.targetType === 'fleets'
                   && acc.targetId === fleet._id;
          });
          if (access.length === 0)
            return _next();
          fleet.sub = [];
          var __next = _.after(access.length, _next);
          _.each(access, function (acc) {
            userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
                                                        function (err, doc) {
              if (err) return cb(err);
              doc.type = acc.granteeType;
              delete doc.vehicles;
              delete doc.fleets;
              // TODO: get team members, admins, domains
              // add them to the team's sub.
              fleet.sub.push(doc);
              __next();
            });
          });
        });
      },
      function (err) {
        if (err) return cb(err);
        cb(null, tree);
      }
    );
  }

  function fetchTeamTree(cb) {
    var self = this;
    var accessList;
    var tree = [];
    Step(
      function () {
        userDb.getAccessList(this.parallel());
        userDb.collections.teams.find({}).toArray(this.parallel());
      },
      function (err, list, teams) {
        if (err) return cb(err);
        var next = this;
        accessList = list;
        if (teams.length === 0)
          return cb(null, []);
        var _next = _.after(teams.length, next);
        _.each(teams, function (team) {
          team.type = 'teams';
          var access = _.filter(accessList, function (acc) {
            return acc.granteeType === 'teams'
                   && acc.granteeId === team._id;
          });
          tree.push(team);
          if (access.length === 0)
            return _next();
          team.sub = [];
          var __next = _.after(access.length, _next);
          _.each(access, function (acc) {
            userDb.collections[acc.targetType].findOne({ _id: acc.targetId },
                                                        function (err, doc) {
              if (err) return cb(err);
              doc.type = acc.targetType;
              team.sub.push(doc);
              __next();
            });
          });
        });
      },
      function (err) {
        if (err) return cb(err);
        cb(null, tree);
      }
    );
  }

  function fetchFleetTree(cb) {
    var accessList;
    var tree = [];
    Step(
      function () {
        userDb.getAccessList(this.parallel());
        userDb.collections.fleets.find({}).toArray(this.parallel());
      },
      function (err, list, fleets) {
        if (err) return cb(err);
        var next = this;
        accessList = list;
        if (fleets.length === 0)
          return cb(null, []);
        var _next = _.after(fleets.length, next);
        _.each(fleets, function (fleet) {
          fleet.type = 'fleets';
          var access = _.filter(accessList, function (acc) {
            return acc.targetType === 'fleets'
                   && acc.targetId === fleet._id;
          });
          tree.push(fleet);
          if (access.length === 0)
            return _next();
          fleet.sub = [];
          var __next = _.after(access.length, _next);
          _.each(access, function (acc) {
            userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
                                                        function (err, doc) {
              if (err) return cb(err);
              doc.type = acc.granteeType;
              delete doc.vehicles;
              delete doc.fleets;
              // TODO: get team members, admins, domains
              // add them to the team's sub.
              fleet.sub.push(doc);
              __next();
            });
          });
          // TODO: add fleet vehicles to sub
        });
      },
      function (err) {
        if (err) return cb(err);
        cb(null, tree);
      }
    );
  }

  //// Methods that need authorization ////

  // Fetch samples.
  // TODO: get rid of subscriptions, 
  // replace with 'wait until data available' option.
  function fetchSamples(vehicleId, channelName, options, cb) {
    if (!UserDb.haveAccess(vehicleId, req.user.data.vehicles))
      return cb('Permission denied.');
    sampleDbExecutionQueue(function (done) {
      var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
      function next(err, samples) {
        cb(err, samples);
        // TODO: subscriptions broken with execution queue.
        done();
      };
      if (options.subscribe != null) {
        var handle = options.subscribe;
        options.subscribe = 0.25;  // Polling interval, seconds.
        cancelSubscribeSamples(handle);
        subscriptions[handle] =
            sampleDb.fetchSamples(vehicleId, channelName, options, next);
      } else {
        sampleDb.fetchSamples(vehicleId, channelName, options, next);
      }
    });
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
    sampleDb.insertSamples(vehicleId, sampleSet, options, cb);
  }

  // Fetch channel tree.
  // TODO: move this into client code, use _schema subscription instead.
  function fetchChannelTree(vehicleId, cb) {
    sampleDb.fetchSamples(vehicleId, '_schema', {},
                          errWrap(cb, function (samples) {
      cb(null, SampleDb.buildChannelTree(samples));
    }));
  }

  function fetchVehicleConfig(vehicleId, cb) {
    var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
    var templateFilePath = __dirname + '/public/vconfig/template.xml';
    fs.readFile(idFilePath, 'utf8',
        function (err, data) {
      if (err) {
        fs.readFile(templateFilePath, 'utf8',
            function (err, data) {
          data = data.replace(/\[vid\]/, vehicleId);
          fs.writeFile(idFilePath, data, function (err) {
            log("XML Configuration File CREATED for Vehicle " + vehicleId);
            cb(err, data);
          });
        });
      } else {
        cb(err, data);
      }
    });
  }

  function saveVehicleConfig(vehicleId, data, cb) {
    var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
    var generation = data.match(/<config generation="([0-9]*)">/);
    if (generation && generation[1] !== "") {
      var genNum = parseInt(generation[1]);
      data = data.replace('<config generation="' + genNum + '">',
                          '<config generation="' + (genNum + 1) + '">');
    }
    fs.writeFile(idFilePath, data, function (err) {
      log("XML Configuration File SAVED for Vehicle " + vehicleId);
      cb(err, data);
    });
  }


  //// Methods that do NOT need authorization ////

  /*
   * Stop receiving subscription data.
   */
  function cancelSubscribeSamples(handle, cb) {
    // No need to check auth.
    if (handle != null && subscriptions[handle]) {
      sampleDb.cancelSubscription(subscriptions[handle]);
      delete subscriptions[handle];
    }
    if (cb) cb();
  }

  /*
   * Create a new link describing a GUI state.
   */
  function saveLink(str, cb) {
    userDb.createLink({ val: str }, function (err, link) {
      cb(err, link.key);
    });
  }


  //// Methods accessible to remote side: ////

  return {
    authorize: authorize,
    fetchVehicles: fetchVehicles,
    fetchEvents: fetchEvents,

    fetchFinderTree: fetchFinderTree,

    fetchSamples: ensureAuth(fetchSamples),
    insertSamples: ensureAuth(insertSamples, ['insert']),
    fetchChannelTree: ensureAuth(fetchChannelTree),
    fetchVehicleConfig: ensureAuth(fetchVehicleConfig, ['config']),
    saveVehicleConfig: ensureAuth(saveVehicleConfig, ['config']),
    addNote: ensureAuth(insertSamples, ['note']),

    cancelSubscribeSamples: cancelSubscribeSamples,
    saveLink: saveLink,
  };
};

////////////// Initialize and Listen

var userDb, sampleDb;

if (!module.parent) {

  Step(
    // Connect to SampleDb:
    function () {
      log('Connecting to SampleDb:', argv.db);
      mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
    }, function (err, db) {
      if (err) return this(err);
      new UserDb(db, { ensureIndexes: true }, this.parallel());
      new SampleDb(db, { ensureIndexes: true }, this.parallel());
    }, function (err, newUserDb, newSampleDb) {
      if (err) return this(err);
      userDb = newUserDb;
      sampleDb = newSampleDb;
      this();
    },

    // Listen:
    function (err) {
      if (err) return this(err);
      app.listen(argv.port);
      dnode(createDnodeConnection)
          .use(dnodeLogMiddleware)
          .listen(app, {
            io: { // 'log level': 2,
              transports: [
                'websocket',
                //'htmlfile',  // doesn't work
                'xhr-polling'
                //'jsonp-polling',  // doesn't work
              ]
            }
          })
          .server.socket.set('authorization', function (data, cb) {
            if (!data || !data.headers || !data.headers.cookie)
              return cb(new Error('No cookie.'));
            var cookies = connect.utils.parseCookie(data.headers.cookie);
            var sid = cookies['connect.sid'];
            if (!sid) return cb(new Error('No session identifier in cookie.'));
            app.settings.sessionStore.load(sid, function (err, sess) {
              if (err) return cb(err);
              if (!sess) return cb(new Error('Could not find session.'));
              log('Session opened', '(sid:' + sid + ')');
              data.session = sess;
              cb(null, true);
            });
            // TODO: Keep the session alive on with a timeout.
          });
      if (!app.address())
        log('Express server could not listen on port '+ argv.port +'!');
      log('Express server listening on port', app.address().port);
    }
  );
}
