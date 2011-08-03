
/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  , ObjectID = require('mongoose/lib/mongoose/types/objectid')
  , jade = require('jade')
  , mongodb = require('mongodb')
  , MongoStore = require('connect-mongodb')
  , gzip = require('connect-gzip')
  , dnode = require('dnode')
  , fs = require('fs')
  , sys = require('sys')
  , path = require('path')
  , csv = require('csv')
  , util = require('util'), debug = util.debug, inspect = util.inspect
  , _ = require('underscore')
  , Step = require('step')
  , EventID = require('./customids').EventID
  , models = require('./models')
  , ProtobufSchema = require('protobuf_for_node').Schema
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../mission-java/common/src/main/protobuf/Events.desc'))
  , EventWebUpload = Event['event.EventWebUpload']
  , Notify = require('./notify')
  , SampleDb = require('./sample_db.js').SampleDb;
;

var db, User, Vehicle, LoginToken;


/////////////// Helpers


/**
 * Loads current session user.
 */

function loadUser(req, res, next) {
  debugger;
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
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
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
  app.set('db-uri-sessions', 'mongodb://:27017/service-sessions');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});


app.configure('production', function () {
  app.set('db-uri-mongoose', 'mongodb://10.201.227.195:27017/service-production,mongodb://10.211.174.11:27017,mongodb://10.207.62.61:27017');
  app.set('db-uri-mongodb', 'mongodb://10.201.227.195:27017,10.211.174.11:27017,10.207.62.61:27017/service-production');
  app.set('db-uri-sessions', 'mongodb://10.201.227.195:27017,10.211.174.11:27017,10.207.62.61:27017/service-sessions');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = true;
});


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
  express.bodyParser.parse['application/octet-stream'] = Buffer;
  app.use(express.cookieParser());

  var sessionServerDb =
      mongodb.connect(app.set('db-uri-sessions'), { noOpen: true }, function() {});
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
  User.findOne({ email: email }, function (err, usr) {
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
  });
});


/**
 * Load vehicle by vehicleId request param.
 */

app.param('vid', function (req, res, next, id) {
  Vehicle.findById(id, function (err, veh) {
    if (!err && veh) {
      req.vehicle = veh;
      util.log('vid ' + id + ' -> ' + util.inspect(veh));
      next();
    } else {
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
    }
  });
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

app.get('/', loadUser, function (req, res) {
  var filterUser;
  if (req.currentUser.role === 'admin') {
    filterUser = null;
  } else if (req.currentUser.role === 'office') {
    filterUser = ['4ddc6340f978287c5e000003', '4ddc84a0c2e5c2205f000001', '4ddee7a08fa7e041710001cb'];
  } else {
    filterUser = req.currentUser;
  }
  findVehiclesByUser(filterUser, function (vehicles) {
    debug('vehicles: ' + inspect(vehicles));
    Step(
      // Add lastSeen to all vehicles in parallel.
      function() {
        var parallel = this.parallel;
        vehicles.forEach(function (v) {
          var next = parallel();
          sampleDb.fetchRealSamples(v._id, '_cycle', null, null, 0,
                                    function(err, cycles) {
            SampleDb.sortSamplesByTime(cycles);
            debug('vehicle ' + v._id + ' cycles: ' + inspect(cycles));
            if (cycles && cycles.length > 0)
              v.lastSeen = cycles[cycles.length - 1].end;
            next();
          });
        });
        parallel()(); // In case there are no vehicles.
      }, function(err) {
        if (err) { this(err); return; }

        // Only keep vehicles which have drive cycles.
        vehicles = vehicles.filter(function(v) { return v.lastSeen != null; });
        debug('vehicles filtered: ' + inspect(vehicles));

        // Sort by lastSeen.
        vehicles.sort(function (a, b) {
          return b.lastSeen - a.lastSeen;
        });

        if (vehicles.length > 0) {
          // TODO: include a session cookie to prevent known-id attacks.
          res.render('index', {
              data: vehicles
            , user: req.currentUser
          });
        } else {
          res.render('empty', {
            user: req.currentUser
          });
        }
      }
    );
  });
});


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


// Get one vehicle data over some time span

var getVehicleData = function(vehicleId, channels, beginTime, endTime, options,
                              cb) {
  if (_.isString(channels))
    channels = [channels];
  var minDuration = options.minDuration || 0;
  var getMinMax = options.getMinMax;

  var sampleSet = {};
  debug('getVehicleData(' + vehicleId + ', ' + inspect(channels) + ', ' + beginTime + ', ' + endTime + '...)');
  Step(
    function fetch() {
      var parallel = this.parallel;
      channels.forEach(function(channelName) {
        var next = parallel();
        debug('fetching ' + channelName);
        sampleDb.fetchMergedSamples(vehicleId, channelName, beginTime, endTime,
                                    minDuration, { getMinMax: getMinMax },
                                    function(err, samples) {
          if (err)
            log('IGNORING ERROR fetching data for vehicle ' + vehicleId +
                ', channel ' + channelName + ': ' + err.stack);
          if (samples) {
            SampleDb.sortSamplesByTime(samples);
            sampleSet[channelName] = samples;
            debug('channel ' + channelName + ': ' + samples.length + ' samples');
          }
          next();
        });
      });
      parallel()(); // In case there are no channels.
    },
    function ret(err) {
      cb(err, sampleSet);
    }
  );
}

var getVehicleCycles = function(vehicleId, cb) {
  // get all vehicle cycles
  sampleDb.fetchRealSamples(vehicleId, '_cycle', null, null, 0,
                            function(err, cycles) {
    debug('getVehicleCycles(' + vehicleId + '): ' + inspect(cycles));
    SampleDb.sortSamplesByTime(cycles);
    cb(err, cycles);
  });
}


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


// Handle cycle events request

app.put('/cycle', function (req, res) {

  // check that body was encoded properly
  if (!(req.body instanceof Buffer)) {
    res.send({ status: 'fail', data: { code: 'BAD_PROTOBUF_FORMAT' } });
    return;
  }

  // parse to JSON
  var cycle = EventWebUpload.parse(new Buffer(req.rawBody, 'binary'))
    , num = cycle.events.length
    , cnt = 0
  ;

  // get the cycle's user
  User.findOne({ email: cycle.userId }, function (err, usr) {
    if (usr) {

      // authenticate user
      if (usr.authenticate(cycle.password)) {

        // get the cycle's vehicle
        findVehicleByIntId(cycle.vehicleId, function (veh) {
          if (veh) {

            // save the cycle locally for now
            var fileName = veh.year + '.' + veh.make + '.' + veh.model + '.' + (new Date()).valueOf() + '.js';
            fs.mkdir(__dirname + '/cycles', '0755', function (err) {
              fs.writeFile(__dirname + '/cycles/' + fileName, JSON.stringify(cycle), function (err) {
                  if (err) {
                    sys.puts(err);
                  } else {
                    sys.puts('Saved to: ' + __dirname + '/cycles/' + fileName);
                  }
              });
            });

            // loop over each cycle in event
            cycle.events.forEach(function (event) {

              // check for empty events
              if (!event.events) {
                res.end();
                return;
              }

              // TMP: use SENSOR_GPS to determine of this cycle is "valid"
              var validCnt = 0
                , driveHeader
                , events = []
              ;

              // count location events and find drive session header
              for (var i = 0, len = event.events.length; i < len; i++) {
                if (event.events[i].header.source === 'SENSOR_GPS' && 'location' in event.events[i]) {
                  validCnt++;
                }
                if (event.events[i].header.type === 'DRIVE_SESSION') {
                  driveHeader = event.events[i].header;
                }
                if (event.events[i].header.type !== 'ANNOTATION' && event.events[i].header.source !== 'SENSOR_COMPASS') {
                  events.push(event.events[i]);
                }
              }

              // check for drive session header
              if (!driveHeader) {
                cnt++;
                if (cnt === num) {
                  res.end();
                }

              // add new cycle
              } else {
                event.events = events;
                event.valid = validCnt > 20;
                event.bounds = {
                    start: driveHeader.startTime
                  , stop: driveHeader.stopTime
                };
                event._id = new EventID({ id: veh._id, time: driveHeader.startTime });
                var bucket = new EventBucket(event);
                bucket.save(function (err) {
                  cnt++;
                  if (cnt === num) {
                    res.end();
                  }
                });
              }

            });

          } else {
            res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
          }
        });

      } else {
        res.send({ status: 'fail', data: { code: 'INCORRECT_PASSWORD' } });
      }

    } else {
      res.send({ status: 'fail', data: { code: 'USER_NOT_FOUND' } });
    }
  });
});


////////////// DNode Methods


function verifySession(sessionInfo, cb) {
  if (!_.isObject(sessionInfo)) {
    cb(new Error('Missing sessionInfo.'));
    return false;
  }
  if (!_.isString(sessionInfo.userEmail)) {
    cb(new Error('Session missing email.'));
    return false;
  }
  if (!_.isString(sessionInfo.userId)) {
    cb(new Error('Session missing userId.'));
    return false;
  }
  // TODO: verify that this is a valid and logged-in session.
  return true;
}


var dnodeMethods = {
  getVehicleCycles: function(sessionInfo, vehicleId, cb) {
    if (!verifySession(sessionInfo, cb))
      cb(new Error('Could not verify session'));
    else
      getVehicleCycles(vehicleId, cb);
  },
  getVehicleData: function(sessionInfo,
                           vehicleId, channels, beginTime, endTime, options,
                           cb) {
    if (!verifySession(sessionInfo, cb))
      cb(new Error('Could not verify session'));
    else
      getVehicleData(vehicleId, channels, beginTime, endTime, options, cb);
  },
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
      new SampleDb(db, {}, this);
    }, function(err, newSampleDb) {
      if (err) { this(err); return; }
      sampleDb = newSampleDb;
      this();
    },

    // Listen:
    function(err) {
      if (err) { this(err); return; }
      app.listen(8080);
      dnode(dnodeMethods).listen(app);
      util.log("Express server listening on port " + app.address().port);
    }
  );
}
