
/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  , jade = require('jade')
  , MongoStore = require('connect-mongodb')
  , gzip = require('connect-gzip')
  , fs = require('fs')
  , sys = require('sys')
  , path = require('path')
  , csv = require('csv')
  , util = require('util')
  , EventID = require('./customids').EventID
  , models = require('./models')
  , db
  , User
  , Vehicle
  , EventBucket
  , LoginToken
  , ProtobufSchema = require('protobuf_for_node').Schema
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../mission-java/henson/common/src/main/protobuf/Events.desc'))
  , EventWebUpload = Event['event.EventWebUpload']
  , Notify = require('./notify')
;


/////////////// Helpers


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
 * which is the first 4 bytes of _id
 */

function findVehicleByIntId(id, next) {
  if ('string' === typeof id) {
    id = parseInt(id);
  }
  var to = new EventID({ id: id, time: (new Date()).getTime() })
    , from = new EventID(to.toHexString().substr(0,8) + '0000000000000000')
  ;
  Vehicle.collection.findOne({ _id: { $gt: from, $lt: to } }, function (err, veh) {
    next(veh);
  });
}


/**
 * Gets all vehicle cycles but does not populate events.
 */


function findVehicleCycles(id, from, to, next) {
  if ('function' === typeof from) {
    next = from;
    from = 0;
    to = (new Date()).getTime();
  } else if ('function' === typeof to) {
    next = to;
    to = (new Date()).getTime();
  }
  from = from === 0 ? id : new EventID({ id: id.vehicleId, time: (new Date(from)).getTime() });
  to = new EventID({ id: id.vehicleId, time: to });
  EventBucket.collection.find({ _id: { $gt: from, $lt: to } }, { sort: '_id', fields: [ '_id', 'bounds' ] }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length === 0) {
        next([]);
      } else {
        next(bucks);
        // getCycle('6284fb404de715df03180003', function () {
        //   console.log('sfvsdfvsdfvdv');
        // });
        // var len = bucks.length
        //   , cnt = 0;
        // bucks.forEach(function (b) {
        //   getCycle(b._id, function () {
        //     //console.log('done');
        //     cnt++;
        //     if (cnt === len) {
        //       next(bucks);
        //     }
        //   });
        // });
      }
    });
  });
}


/**
 * Gets a single cycle including all events.
 */


function getCycle(id, next) {
  EventBucket.findById(id, function (err, data) {
    if (!err && data) {
      var events = []
        , len = data.events.length
        , every = len > 1000 ? Math.round(len / 2000) : 1
        , start_orig = parseInt(data.bounds.start)
        , stop_orig = parseInt(data.bounds.stop)
      ;
      // console.log(start_orig === stop_orig);
      //       if (start_orig === stop_orig) {
      //         var start = 9999999999999
      //           , stop = 0
      //         ;
      //         for (var i = 0; i < len; i++) {
      //           var s = parseInt(data.events[i].header.startTime)
      //             , p = parseInt(data.events[i].header.stopTime)
      //           ;
      //           if (s < start) {
      //             start = s;
      //           }
      //           if (p > stop) {
      //             stop = p;
      //           }
      //         }
      //         EventBucket.collection.findAndModify({ _id: id }, [['_id','asc']], { $set: { bounds: { start: start, stop: stop } } }, {}, function(err, object) {
      //           if (err) {
      //             console.warn(err.message);
      //           } else {
      //             getCycle(id, next);
      //           }
      //         });
      // } else {
        for (var i = 0; i < len; i++) {
          // if (data.events[i].header.type !== 'ANNOTATION' && i % every === 0) {
          if (data.events[i].header.type !== 'ANNOTATION') {
            events.push(data.events[i]);
          }
        }
        data.events = events;
        next(data);
      // }
    } else {
      next(null);
    }
  });
}


/////////////// Configuration

var app = module.exports = express.createServer();


app.configure('development', function () {
  app.set('db-uri', 'mongodb://localhost:27017/service-development,mongodb://localhost:27018,mongodb://localhost:27019');
  app.set('sessions-host', 'localhost');
  app.set('sessions-port', [27017, 27018, 27019]);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});


app.configure('test', function () {
  app.set('db-uri', 'mongodb://localhost:27017/service-test,mongodb://localhost:27018,mongodb://localhost:27019');
  app.set('sessions-host', 'localhost');
  app.set('sessions-port', [27017, 27018, 27019]);
  Notify.active = false;
});


app.configure('production', function () {
  app.set('db-uri', 'mongodb://50.19.108.253:27017/service-production,mongodb://50.19.106.243:27017,mongodb://50.19.106.238:27017');
  app.set('sessions-host', ['50.19.108.253','50.19.106.243','50.19.106.238']);
  app.set('sessions-port', 27017);
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
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one day 86400
    secret: 'topsecretmission',
    store: new MongoStore({
      host: app.set('sessions-host'),
      port: app.set('sessions-port'),
      dbname: 'service-sessions'
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
  app.EventBucket = EventBucket = mongoose.model('EventBucket');
  app.LoginToken = LoginToken = mongoose.model('LoginToken');
  db = mongoose.connectSet(app.set('db-uri'));
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
      next();
    } else {
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
    }
  });
});


/**
 * Load vehicle by vehicleId request param.
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
  findVehiclesByUser(filterUser, function (vehs) {
    var vehicles = []
      , num = vehs.length
      , cnt = 0
    ;
    if (num > 0) {
      vehs.forEach(function (v) {
        findVehicleCycles(v._id, function (bucks) {
          var numBucks = bucks.length;
          if (numBucks > 0) {
            v.lastSeen = parseInt(bucks[numBucks - 1].bounds.stop);
            vehicles.push(v);
          }
          cnt++;
          if (cnt === num) {
            vehicles.sort(function (a, b) {
              return b.lastSeen - a.lastSeen;
            });
            if (vehicles.length > 0) {
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
        });
      });
    } else {
      res.render('empty', {
        user: req.currentUser
      });
    }
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


// Get one vehicle route

app.get('/v/:vid', function (req, res) {
  // get all vehicle events (handle only)
  findVehicleCycles(req.vehicle._id, function (bucks) {
    if (bucks.length > 0) {
      // get only the latest cycle's data
      var events = []
        , buckIndex = bucks.length - 1
      ;
      (function fillEvents() {
        getCycle(bucks[buckIndex]._id, function (cyc) {
          if (cyc) {
            // TMP: use SENSOR_GPS latitude to determine of this cycle is "valid"
            var validCnt = 0;
            for (var i = 0, len = cyc.events.length; i < len; i++) {
              if (cyc.events[i].header.source === 'SENSOR_GPS' && 'location' in cyc.events[i]) {
                validCnt++;
              }
            }
            if (validCnt < 20) {
              bucks.pop();
              buckIndex--;
              if (buckIndex !== -1) {
                fillEvents();
              } else {
                res.send({ status: 'fail', data: { code: 'NO_CYCLE_EVENTS' } });
              }
            } else {
              bucks[buckIndex] = cyc;
              res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
            }
          } else {
            res.send({ status: 'fail', data: { code: 'NO_CYCLE_EVENTS' } });
          }
        });
      })();
    } else {
      res.send({ status: 'fail', data: { code: 'NO_VEHICLE_CYCLES' } });
    }
  });
});


// Get requested cycles and their events

app.get('/cycles', function (req, res) {
  if (req.body && req.body.cycles) {
    var cycleIds = req.body.cycles
      , num = cycleIds.length
      , cnt = 0
      , events = {}
    ;
    cycleIds.forEach(function (id) {
      getCycle(id, function (cyc) {
        if (cyc) {
          // TMP: use SENSOR_GPS latitude to determine of this cycle is "valid"
          var validCnt = 0;
          for (var i = 0, len = cyc.events.length; i < len; i++) {
            if (cyc.events[i].header.source === 'SENSOR_GPS' && 'location' in cyc.events[i]) {
              validCnt++;
            }
          }
          events[cyc._id] = validCnt < 20 ? null : cyc.events;
          cnt++;
          if (num === cnt) {
            res.send({ status: 'success', data: { events: events } });
          }
        } else {
          res.send({ status: 'fail', data: { code: 'NO_VEHICLE_CYCLES' } });
        }
      });
    });
  } else {
    res.send({ status: 'fail', data: { code: 'NO_CYCLES_REQUESTED' } });
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
  if (missing.length != 0) {
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
      _id: new EventID()
    , make: req.params.make
    , model: req.params.model
    , year: req.params.year
    , user_id: req.currentUser._id
  });
  v.save(function (err) {
    if (!err) {
      res.send({ status: 'success', data: { vehicleId: v._id.vehicleId } });
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
  if (!(req.body instanceof Buffer)) {
    res.send({ status: 'fail', data: { code: 'BAD_PROTOBUF_FORMAT' } });
    return;
  }
  var cycle = EventWebUpload.parse(new Buffer(req.rawBody, 'binary'))
    , num = cycle.events.length
    , cnt = 0
  ;

  // authenticate user
  User.findOne({ email: cycle.userId }, function (err, usr) {
    if (usr) {
      if (usr.authenticate(cycle.password)) {
        findVehicleByIntId(cycle.vehicleId, function (veh) {
          if (veh) {
            cycle.events.forEach(function (event) {
              // TMP: use SENSOR_GPS to determine of this cycle is "valid"
              var validCnt = 0;
              if (!event.events) {
                res.end();
                return;
              }
              for (var i = 0, len = event.events.length; i < len; i++) {
                if (event.events[i].header.source === 'SENSOR_GPS' && 'location' in event.events[i]) {
                  validCnt++;
                }
              }
              event.valid = validCnt > 20;
              event.bounds = {
                  start: event.events[0].header.startTime
                , stop: event.events[0].header.stopTime
              };
              event._id = new EventID({ id: veh._id.vehicleId, time: event.events[0].header.startTime });
              var bucket = new EventBucket(event);
              bucket.save(function (err) {
                cnt++;
                if (cnt === num) {
                  res.end();
                }
              });
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


////////////// Listen on 8080 (maps to 80 on EC2)


if (!module.parent) {
  app.listen(8080);
  util.log("Express server listening on port " + app.address().port);
}
