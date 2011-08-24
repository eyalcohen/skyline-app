
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
var csv = require('csv');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');
var Step = require('step');
var EventID = require('./customids').EventID;
var models = require('./models');
var ProtobufSchema = require('protobuf_for_node').Schema;
var Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../mission-java/common/src/main/protobuf/Events.desc'));
var WebUploadSamples = Event['event.WebUploadSamples'];
var EventWebUpload = Event['event.EventWebUpload'];
var Notify = require('./notify');
var SampleDb = require('./sample_db.js').SampleDb;
var compatibility = require('./compatibility.js');

var db, User, Vehicle, LoginToken;

var pubsub = require('./minpubsub');


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
    ignore: ['sys', 'markdown', 'markdown-js', 'discount'],
    require : ['dnode', 'backbone', './minpubsub']
  }));
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
    Step(
      // Add lastSeen to all vehicles in parallel.
      function() {
        var parallel = this.parallel;
        vehicles.forEach(function (v) {
          var next = parallel();
          sampleDb.fetchSamples(v._id, '_wake', {}, function(err, cycles) {
            if (cycles && cycles.length > 0)
              v.lastSeen = _.max(_.pluck(cycles, 'end'));
            next();
          });
        });
        parallel()(); // In case there are no vehicles.
      }, function(err) {
        if (err) { this(err); return; }

        // Only keep vehicles which have drive cycles.
        vehicles = vehicles.filter(function(v) { return v.lastSeen != null; });

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
    if (!(req.body instanceof Buffer)) {
      fail('BAD_PROTOBUF_FORMAT');
      return;
    }
    uploadSamples = WebUploadSamples.parse(new Buffer(req.rawBody, 'binary'));
  } else if (mimeType == 'application/json') {
    uploadSamples = req.body;
  } else {
    fail('BAD_ENCODING:' + mimeType);
    return;
  }

  var usr, veh, fname;
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
      findVehicleByIntId(uploadSamples.vehicleId, this);
    }, function(veh_) {
      veh = veh_;
      if (!veh)
        fail('VEHICLE_NOT_FOUND');
      else
        this();
    },

    // save the cycle locally for now
    function() {
      var fileName = veh.year + '.' + veh.make + '.' + veh.model + '.' +
          (new Date()).valueOf() + '.js';
      fs.mkdir(__dirname + '/samples', '0755', function (err) {
        fs.writeFile(__dirname + '/samples/' + fileName,
                     JSON.stringify(uploadSamples), function (err) {
          if (err)
            util.log(err);
          else
            util.log('Saved to: ' + __dirname + '/samples/' + fileName);
        });
      });
      this();
    },

    // Store the data in the database.
    function() {
      // Process samples.
      var sampleSet = {};
      var firstError;
      uploadSamples.sampleStream.forEach(function(sampleStream) {
        // kevinh - the delta times start again for each sampleStream
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
      sampleDb.insertSamples(veh._id, sampleSet, this);
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


// Every time a client connects via dnode, this function will be called, and
// the object it returns will be transferred to the client.
var createDnodeConnection = function (remote, conn) {
  var subscriptions = { };

  //// Methods accessible to remote side: ////

  function fetchSamples(sessionInfo, vehicleId, channelName, options, cb) {
    if (!verifySession(sessionInfo, cb)) {
      cb(new Error('Could not verify session'));
      return;
    }

    var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
    console.time(id);
    function next(err, samples) {
      console.timeEnd(id);
      if (err)
        console.log('Error in ' + id + ': ' + err.stack);
      cb(err, samples);
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

  function cancelSubscribeSamples(handle) {
    if (handle != null && subscriptions[handle]) {
      sampleDb.cancelSubscription(subscriptions[handle]);
      delete subscriptions[handle];
    }
  }

  conn.on('end', function () {
    _.keys(subscriptions).forEach(cancelSubscribeSamples);
  });

  return {
    fetchSamples: fetchSamples,
    cancelSubscribeSamples: cancelSubscribeSamples,
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

      // setInterval(function () {
      //   var n = Math.floor(Math.random() * 100);
      //   pubsub.publish('data', [n]);
      // }, 100);

      // dnode(function (client, conn) {
      //   this.subscribe = pubsub.subscribe;
      // }).listen(8080).listen(app);

      dnode(createDnodeConnection).listen(8081).listen(app);
      util.log("Express server listening on port " + app.address().port);
    }
  );
}
