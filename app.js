
/**
 * Module dependencies.
 */

var express = require('express');
var mongoose = require('mongoose');
var ObjectID = require('mongoose/lib/mongoose/types/objectid');
var jade = require('jade');
var mongodb = require('mongodb');
var MongoStore = require('connect-mongodb');
var gzip = require('connect-gzip');
var dnode = require('dnode');
var fs = require('fs');
var sys = require('sys');
var path = require('path');
var CSV = require('csv');
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
var Notify = require('./notify');
var SampleDb = require('./sample_db.js').SampleDb;
var compatibility = require('./compatibility.js');

var db, User, Vehicle, LoginToken;

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
 * Loads current session user.
 */

function loadUser(req, res, next) {
  if (req.session.user_id) {
    User.findById(req.session.user_id, function (err, usr) {
      if (usr) {
        req.currentUser = usr;
        next();
      } else {
        res.redirect('/login');
      }
    });
  } else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, next);
  } else {
    res.redirect('/login');
  }
}


/**
 * Logs in with a cookie.
 */

function authenticateFromLoginToken(req, res, next) {
  var cookie = JSON.parse(req.cookies.logintoken);
  LoginToken.findOne({
      email: cookie.email
    , series: cookie.series
    , token: cookie.token }, (function (err, token) {
    if (!token) {
      res.redirect('/login');
      return;
    }
    User.findOne({ email: token.email }, function (err, usr) {
      if (usr) {
        req.session.user_id = usr.id;
        req.currentUser = usr;
        token.token = token.randomToken();
        token.save(function () {
          res.cookie('logintoken', token.cookieValue, {
              expires: new Date(Date.now() + 2 * 604800000),
              path: '/'
          });
          next();
        });
      } else {
        res.redirect('/login');
      }
    });
  }));
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


/////////////// Configuration

var app = module.exports = express.createServer();


app.configure('development', function () {
  app.set('db-uri-mongoose', 'mongodb://localhost:27017/service-samples,mongodb://localhost:27018,mongodb://localhost:27019');
  app.set('db-uri-mongodb', 'mongodb://:27017,:27018,:27019/service-samples');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});


app.configure('production', function () {
  app.set('db-uri-mongoose', 'mongodb://10.201.227.195:27017/service-samples,mongodb://10.211.174.11:27017,mongodb://10.207.62.61:27017');
  app.set('db-uri-mongodb', 'mongodb://10.201.227.195:27017,10.211.174.11:27017,10.207.62.61:27017/service-samples');
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

  var sessionServerDb =
      mongodb.connect(app.set('db-uri-mongodb'), { noOpen: true }, function() {});
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one day 86400
    secret: 'topsecretmission',
    store: new MongoStore({ db: sessionServerDb, }, function (err) {
      if (err) util.log('Error creating MongoStore: ' + err);
    })
  }));
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(require('browserify')({
    require : ['dnode', 'underscore', 'step', './minpubsub', './shared_utils']
  }).use(jadeify(__dirname + '/public/javascripts/templates')));
});


models.defineModels(mongoose, function () {
  app.User = User = mongoose.model('User');
  app.Vehicle = Vehicle = mongoose.model('Vehicle');
  app.LoginToken = LoginToken = mongoose.model('LoginToken');
  db = mongoose.connectSet(app.set('db-uri-mongoose'));
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
        res.send({ status: 'fail', data: { code: 'INCORRECT_PASSWORD' } });
      }
    } else {
      res.send({ status: 'fail', data: { code: 'USER_NOT_FOUND' } });
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
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
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
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
    }
  });
});


////////////// Web Routes

// Home

app.get('/', function (req, res) {
  res.render('index');
});

// app.get('/', loadUser, function (req, res) {
//   var filterUser;
//   if (req.currentUser.role === 'admin') {
//     filterUser = null;
//   } else if (req.currentUser.role === 'office') {
//     filterUser = ['4ddc6340f978287c5e000003', '4ddc84a0c2e5c2205f000001', '4ddee7a08fa7e041710001cb'];
//   } else {
//     filterUser = req.currentUser;
//   }
//   findVehiclesByUser(filterUser, function (vehicles) {
//     Step(
//       // Add lastSeen to all vehicles in parallel.
//       function() {
//         var parallel = this.parallel;
//         vehicles.forEach(function (v) {
//           var next = parallel();
//           sampleDb.fetchSamples(v._id, '_wake', {}, function(err, cycles) {
//             if (cycles && cycles.length > 0)
//               v.lastSeen = _.max(_.pluck(cycles, 'end'));
//             next();
//           });
//         });
//         parallel()(); // In case there are no vehicles.
//       }, function(err) {
//         if (err) { this(err); return; }
//
//         // Only keep vehicles which have drive cycles.
//         vehicles = vehicles.filter(function(v) { return v.lastSeen != null; });
//
//         // Sort by lastSeen.
//         vehicles.sort(function (a, b) {
//           return b.lastSeen - a.lastSeen;
//         });
//
//         if (vehicles.length > 0) {
//           // TODO: include a session cookie to prevent known-id attacks.
//           res.render('index', {
//               data: vehicles
//             , user: req.currentUser
//           });
//         } else {
//           res.render('empty', {
//             user: req.currentUser
//           });
//         }
//       }
//     );
//   });
// });


// Landing page

app.get('/login', function (req, res) {
  if (req.session.user_id) {
    User.findById(req.session.user_id, function (err, usr) {
      if (usr) {
        req.currentUser = usr;
        res.redirect('/');
      } else {
        res.render('login');
      }
    });
  } else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, function () {
      res.redirect('/');
    });
  } else {
    res.render('login');
  }
});


// Login - add user to session

app.post('/sessions', function (req, res) {
  // check fields
  var missing = [];
  if (!req.body.user.email) {
    missing.push('email');
  }
  if (!req.body.user.password) {
    missing.push('password');
  }
  if (missing.length !== 0) {
    res.send({ status: 'fail', data: { code: 'MISSING_FIELD', message: 'Both your email and password are required for login.', missing: missing } });
    return;
  }
  User.findOne({ email: req.body.user.email }, function (err, usr) {
    if (usr && usr.authenticate(req.body.user.password)) {
      usr.meta.logins++
      usr.save(function (err) {
        if (!err) {
          req.session.user_id = usr.id;
          if (req.body.remember_me) {
            var loginToken = new LoginToken({ email: usr.email });
            loginToken.save(function () {
              res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
              res.send({ status: 'success' });
            });
          } else {
            res.send({ status: 'success' });
          }
        } else {
          res.send({ status: 'error', message: 'We\'re experiencing an unknown problem but are looking into it now. Please try again later.' });
          util.log("Error finding user '" + req.body.user.email + "': " + err);
          Notify.problem(err);
        }
      });
    } else {
      res.send({
          status: 'fail'
        , data: {
              code: 'BAD_AUTH'
            , message: 'That didn\'t work. Your email or password is incorrect.'
          }
      });
    }
  });
});


// Delete a session on logout

app.del('/sessions', loadUser, function (req, res) {
  if (req.session) {
    LoginToken.remove({ email: req.currentUser.email }, function () {});
    res.clearCookie('logintoken');
    req.session.destroy(function () {});
  }
  res.redirect('/login');
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
    if ('toNumber' in vehicleId) vehicleId = vehicleId.toNumber();
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

      csv.write([]);  // Make sure there's a terminating newline.
      csv.end();
      res.end();
    },

    next
  );
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
      res.send({ status: 'fail', data: { code: 'DUPLICATE_EMAIL', message: 'This email address is already being used on our system.' } });
    }
  });
});


// Handle vehicle create request

app.post('/vehiclecreate/:email/:make/:model/:year', function (req, res) {
  var v = new Vehicle({
      _id: parseInt(Math.random() * 0xffffffff)  // TODO: collisions
    , make: req.params.make
    , model: req.params.model
    , year: req.params.year
    , user_id: req.currentUser._id
  });
  v.save(function (err) {
    if (!err) {
      res.send({ status: 'success', data: { vehicleId: v._id } });
    } else {
      res.send({ status: 'error', message: err });
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
    jade.renderFile(path.join(__dirname, 'views', 'summary.jade'), { locals: { user: req.currentUser } }, function (err, body) {
      if (!err) {
        res.send(body);
      }
    });
  } else {
    res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
  }
});


function requestMimeType(req) {
  return (req.headers['content-type'] || '').split(';')[0];
}


// Handle sample upload request

app.put('/samples', function (req, res) {

  function fail(code) {
    util.log('PUT /samples failed: ' + code);
    res.send({ status: 'fail', data: { code: code } });
  }

  // Parse to JSON.
  var uploadSamples, mimeType = requestMimeType(req);
  if (mimeType == 'application/octet-stream') {
    /*
    debug('rawBody: ' + req.rawBody.length + ' (' + inspect(req.rawBody) + ')');
    var fileName = (new Date()).valueOf() + '.pbraw';
    fs.mkdir(__dirname + '/samples', '0755', function (err) {
      fs.writeFile(__dirname + '/samples/' + fileName, req.rawBody, null, function (err) {
        if (err)
          util.log(err);
        else
          util.log('Saved to: ' + __dirname + '/samples/' + fileName);
      });
    });
    */

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
        fs.writeFile(__dirname + '/samples/' + fileName,
                     JSON.stringify(uploadSamples, null, '  '), function (err) {
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
      addDurationHeuristicHack(vehicleId, sampleSet, this);
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
    res.send({ status: 'fail', data: { code: code } });
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

function addDurationHeuristicHack(vehicleId, sampleSet, cb) {
  // This is a hack to add duration to samples which are of zero duration.
  // The algorithm is: for each zero-duration sample, set the begin time to the
  // end of the previous sample, unless that duration exceeds maxDuration.
  // Note that if the first sample of each channel has no duration, we have to
  // query the DB for the previous sample!
  var maxDuration = 10 * SampleDb.s;
  var prevSampleSet = {};
  Step(
    function() {
      // For any channel we might need to synthesize an initial begin, get
      // potentially overlapping data.
      var parallel = this.parallel;
      _.each(sampleSet, function(samples, channelName) {
        var first = _.first(samples);
        if (first && first.beg == first.end) {
          var next = parallel();
          options = { type: 'real',
                      beginTime: first.beg - maxDuration, endTime: first.beg };
          sampleDb.fetchSamples(vehicleId, channelName, options,
                                function(err, samples) {
            prevSampleSet[channelName] = samples;
            if (err)
              util.log('Error in addDurationHeuristicHack while fetching: ' +
                       err.stack);
            next();
          });
        }
      });
      parallel()();
    },
    function(err) {
      if (err) return this(err);
      _.each(sampleSet, function(samples, channelName) {
        var prevEnd = -Number.MAX_VALUE;
        if (prevSampleSet[channelName] && _.last(prevSampleSet[channelName]))
          prevEnd = _.last(prevSampleSet[channelName]).end;
        samples.forEach(function(s) {
          if (s.end <= s.beg) {
            // Synthesize a duration for this sample.
            var dur = Math.max(Math.min(maxDuration, s.beg - prevEnd), 0);
            s.beg -= dur;
          }
          prevEnd = s.end;
        });
      });
      this(null);
    },
    cb
  );
}


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
  var maxArgsChars = 60;
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
          console.log(fnamePretty + '(\x1b[4m' +
                      shortInpsect(funcArgs, maxArgsChars) + '\x1b[0m): ' +
                      'no callback after ' +
                      (Date.now() - start) + ' ms!!!');
        }, 1000);
        funcArgs[funcArgs.length - 1] = function() {
          clearInterval(waiting);
          console.log(fnamePretty + '(\x1b[4m' +
                      shortInpsect(funcArgs, maxArgsChars) +
                      '\x1b[0m) -> (\x1b[4m' +
                      shortInpsect(arguments, maxArgsChars) + '\x1b[0m) ' +
                      (Date.now() - start) + ' ms');
          callback.apply(this, arguments);
        };
        f.apply(this, funcArgs);
      } else {
        var start = Date.now();
        f.apply(this, funcArgs);
        console.log(fnamePretty + '(\x1b[4m' +
                    shortInpsect(funcArgs, maxArgsChars) + '\x1b[0m) ' +
                    (Date.now() - start) + ' ms');
      }
    };
  });
}


// Every time a client connects via dnode, this function will be called, and
// the object it returns will be transferred to the client.
var createDnodeConnection = function (remote, conn) {
  var subscriptions = { };
  var user = null;  // Set once user is authenticated.

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
  function fetchNotifications(cb, opts) {
    if (!checkAuth(cb)) return;
    function callback() {
      notifications.sort(function (a, b) {
        return b.beg - a.beg;
      });
      cb(null, JSON.parse(JSON.stringify(notifications)));
    }
    var notifications = [];
    if (opts && opts.vehicleId) {
      Step(
        function () {
          sampleDb.fetchSamples(opts.vehicleId, '_drive', {}, this.parallel());
          sampleDb.fetchSamples(opts.vehicleId, '_charge', {}, this.parallel());
          sampleDb.fetchSamples(opts.vehicleId, '_error', {}, this.parallel());
          sampleDb.fetchSamples(opts.vehicleId, '_warning', {}, this.parallel());
        },
        function (err, drives, charges, errors, warnings) {
          if (err) { cb(err); return; }
          drives.forEach(function (not) { not.type = '_drive'; });
          charges.forEach(function (not) { not.type = '_charge'; });
          errors.forEach(function (not) { not.type = '_error'; });
          warnings.forEach(function (not) { not.type = '_warning'; });
          notifications = notifications.concat(drives, charges, errors, warnings);
          callback();
        }
      );
    } else {
      var filterUser;
      if (user.role === 'admin') {
        filterUser = null;
      } else if (user.role === 'office') {
        filterUser = ['4ddc6340f978287c5e000003',
            '4ddc84a0c2e5c2205f000001',
            '4ddee7a08fa7e041710001cb'];
      } else { filterUser = user; }
      findVehiclesByUser(filterUser, function (vehicles) { //1088675181
        Step(
          function () {
            var parallel = this.parallel;
            vehicles.forEach(function (v) {
              var next = parallel();
              Step(
                function () {
                  sampleDb.fetchSamples(v._id, '_drive', {}, this.parallel());
                  sampleDb.fetchSamples(v._id, '_charge', {}, this.parallel());
                  sampleDb.fetchSamples(v._id, '_error', {}, this.parallel());
                  sampleDb.fetchSamples(v._id, '_warning', {}, this.parallel());
                },
                function (err, drives, charges, errors, warnings) {
                  if (err) { cb(err); return; }
                  drives.forEach(function (not) { not.type = '_drive'; not.vehicle = v; });
                  charges.forEach(function (not) { not.type = '_charge'; not.vehicle = v; });
                  errors.forEach(function (not) { not.type = '_error'; not.vehicle = v; });
                  warnings.forEach(function (not) { not.type = '_warning'; not.vehicle = v; });
                  notifications = notifications.concat(drives, charges, errors, warnings);
                  next();
                }
              );
            });
            parallel()(); // In case there are no vehicles.
          },
          function (err) {
            if (err) { cb(err); return; }
            callback();
          }
        );
      });
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
            var v = vehicle.doc;
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
    var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
    console.time(id);
    function next(err, samples) {
      cb(err, JSON.parse(JSON.stringify(samples)));
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
  }

  function cancelSubscribeSamples(handle, cb) {
    // No need to check auth.
    if (handle != null && subscriptions[handle]) {
      sampleDb.cancelSubscription(subscriptions[handle]);
      delete subscriptions[handle];
    }
    if (cb) cb();
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
    fs.writeFile(idFilePath, data, function (err) {
      util.log("XML Configuration File SAVED for Vehicle " + vehicleId);
      cb(err);
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
    fetchChannelTree: fetchChannelTree,
    fetchVehicleConfig: fetchVehicleConfig,
    saveVehicleConfig: saveVehicleConfig,
  };
};

////////////// Initialize and Listen on 8080 (maps to 80 on EC2)

var sampleDb;

if (!module.parent) {
  Step(
    // Connect to SampleDb:
    function() {
      mongodb.connect(app.set('db-uri-mongodb'),
                      { server: { poolSize: 4 } },
                      this);
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
      app.listen(8080);

      // setInterval(function () {
      //   var n = Math.floor(Math.random() * 100);
      //   pubsub.publish('data', [n]);
      // }, 100);

      // dnode(function (client, conn) {
      //   this.subscribe = pubsub.subscribe;
      // }).listen(8080).listen(app);

      dnode(createDnodeConnection).use(dnodeLogMiddleware).listen(8081).listen(app);
      util.log("Express server listening on port " + app.address().port);
    }
  );
}
