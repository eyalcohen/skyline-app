
/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  , MongoStore = require('connect-mongodb')
  , fs = require('fs')
  , sys = require('sys')
  , path = require('path')
  , csv = require('csv')
  , parser = require('mongoose/support/node-mongodb-native/lib/mongodb').BinaryParser
  , EventID = require('./customids').EventID
  , data = require('./data')
  , models = require('./models')
  , db
  , User
  , Vehicle
  , EventBucket
  , LoginToken
  , ProtobufSchema = require('protobuf_for_node').Schema
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../mission-java/henson/common/src/main/protobuf/Events.desc'))
  , EventWebUpload = Event['event.EventWebUpload']
  , Stream = require('stream').Stream
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
 * Finds all vehicles.
 */


function findVehicles(next) {
  Vehicle.find({}, [], { limit: 100 }).run(function (err, vehs) {
    var num = vehs.length
      , cnt = 0
    ;
    if (num > 0) {
      vehs.forEach(function (veh) {
        User.findById(veh.user_id, function (err, usr) {
          veh.user = usr;
          cnt++;
          if (cnt == num) {
            next(vehs);
          }
        });
      });
    } else {
      next([]);
    }
  });
}


/**
 * Gets all vehicles owned by user.
 */


function findVehiclesByUser(user, next) {
  Vehicle.find({ user_id: user._id }).sort('created', -1).run(function (err, vehs) {
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
  if ('function' == typeof from) {
    next = from;
    from = 0;
    to = (new Date()).getTime();
  } else if ('function' == typeof to) {
    next = to;
    to = (new Date()).getTime();
  }
  from = from == 0 ? id : new EventID({ id: id.vehicleId, time: (new Date(from)).getTime() });
  to = new EventID({ id: id.vehicleId, time: to });
  EventBucket.collection.find({ _id: { $gt: from, $lt: to } }, { sort: '_id', fields: [ '_id', 'bounds' ] }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length == 0) {
        next([]);
      } else {
        next(bucks);
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
      next(data);
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
});


app.configure('test', function () {
  app.set('db-uri', 'mongodb://localhost:27017/service-test,mongodb://localhost:27018,mongodb://localhost:27019');
  app.set('sessions-host', 'localhost');
  app.set('sessions-port', [27017, 27018, 27019]);
});


app.configure('production', function () {
  app.set('db-uri', 'mongodb://50.19.108.253:27017/service-production,mongodb://50.19.106.243:27017,mongodb://50.19.106.238:27017');
  app.set('sessions-host', ['50.19.108.253','50.19.106.243','50.19.106.238']);
  app.set('sessions-port', 27017);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  express.bodyParser.parse['application/octet-stream'] = Buffer;
  app.use(express.cookieParser());
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 }, // one day 86400
    secret: 'topsecretislandshit',
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


////////////// Web Routes

// Home

app.get('/', loadUser, function (req, res) {
  findVehicles(function (vehs) {
    var vehicles = []
      , num = vehs.length
      , cnt = 0
    ;
    vehs.forEach(function (v) {
      findVehicleCycles(v._id, function (bucks) {
        if (bucks.length > 0) {
          v.events = bucks;
          vehicles.push(v);
        }
        cnt++;
        if (cnt == num) {
          vehicles.sort(function (a, b) {
            return b[b.length - 1]._id.time - a[a.length - 1]._id.time;
          });
          res.render('index', {
              data: vehicles
            , user: req.currentUser
          });
        }
      });
    });
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
      // get only the latest event's data
      var latest = bucks[bucks.length - 1];
      getCycle(latest._id, function (cyc) {
        bucks[bucks.length - 1] = cyc;
        res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
      });
    } else {
      res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
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
        events[cyc._id] = cyc.events;
        cnt++;
        if (num == cnt) {
          res.send({ status: 'success', data: { events: events } });
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

app.get('/summary/:email/:vid', function (req, res) {
  if (req.vehicle.user_id.toHexString() == req.currentUser._id.toHexString()) {
    res.send({ status: 'success', data: { user: req.currentUser, vehicle: req.vehicle } });
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
      if (usr.authenticate(req.body.password)) {
        findVehicleByIntId(cycle.vehicleId, function (veh) {
          if (veh) {
            handleEvents(veh);
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
  
  // add to db
  function handleEvents(v) {
    cycle.events.forEach(function (event) {
      event.bounds = {
          start: event.events[0].header.startTime
        , stop: event.events[0].header.stopTime
      };
      event._id = new EventID({ id: v._id.vehicleId, time: event.events[0].header.startTime });
      var bucket = new EventBucket(event);
      bucket.save(function (err) {
        cnt++;
        if (cnt == num) {
          res.end();
        }
      });
    });
  }
});


////////////// Listen on 8080 (maps to 80 on EC2)


if (!module.parent) {
  app.listen(8080);
  console.log("Express server listening on port %d", app.address().port);
}

