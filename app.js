
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
  , oid = require('mongoose/lib/mongoose/types/objectid')
  , data = require('./data')
  , models = require('./models')
  , db
  , User
  , Vehicle
  , EventBucket
  , LoginToken
  // , Slice1000
  // , Slice20000
  // , Slice1000000
  // , Slice60000000
  // , Slice3600000000
  // , Slice86400000000
  , stub
  , ProtobufSchema = require('protobuf_for_node').Schema
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../../mission-java/henson/common/src/main/protobuf/Events.desc'))
  , EventWebUpload = Event['event.EventWebUpload']
  , Stream = require('stream').Stream
  , Notify = require('./notify')
;

/////////////// Helpers

/**
 * 
 * @param
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
 * 
 * @param
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

function findVehicles(next) {
  Vehicle.find({}, [], { limit: 100 }).run(function (err, vehs) {
    var num = vehs.length
      , cnt = 0
    ;
    if (num > 0)
      vehs.forEach(function (veh) {
        User.findById(veh.user_id, function (err, usr) {
          veh.user = usr;
          cnt++;
          if (cnt == num) {
            // vehs.sort(function (a, b) {
            //   return b._id.time - a._id.time;
            // });
            next(vehs);
          }
        });
      });
    else {
      next([]);
    }
  });
}

function findVehiclesByUser(user, next) {
  Vehicle.find({ user_id: user._id }).sort('created', -1).run(function (err, vehs) {
    if (!err) {
      next(vehs);
    } else {
      next([]);
    }
  });
}

function findVehicle(id, next) {
  var to = new oid(generateId, { vid: id, time: (new Date()).getTime() })
    , from = new oid(to.toHexString().substr(0,8) + '0000000000000000')
  ;
  Vehicle.collection.findOne({ _id: { $gt: from, $lt: to } }, function (err, veh) {
    next(veh);
  });
}

// function findVehicleBuckets(id, slice, from, to, next) {
//   if ('function' == typeof from) {
//     next = from;
//     from = 0;
//     to = (new Date()).getTime();
//   } else if ('function' == typeof to) {
//     next = to;
//     to = (new Date()).getTime();
//   }
//   from = from == 0 ? id : new oid(generateId, { vid: id.vid, time: (new Date(from)).getTime() });
//   to = new oid(generateId, { vid: id.vid, time: to });
//   db.connections[0].collections['slice' + slice + 's'].find({ _id: { $gt: from, $lt: to } }, function (err, cursor) {
//     cursor.toArray(function (err, bucks) {
//       if (err || !bucks || bucks.length == 0) {
//         console.log('vehicle has no data in Slice' + slice);
//         next([]);
//       } else {
//         next(bucks);
//       }
//     });
//   });
// }

function findVehicleEvents(id, from, to, next, events) {
  if ('function' == typeof from) {
    next = from;
    from = 0;
    events = to;
    to = (new Date()).getTime();
  } else if ('function' == typeof to) {
    events = next;
    next = to;
    to = (new Date()).getTime();
  }
  from = from == 0 ? id : new oid(generateId, { vid: id.vid, time: (new Date(from)).getTime() });
  to = new oid(generateId, { vid: id.vid, time: to });
  var fields = events ? null : [ '_id' ];
  EventBucket.collection.find({ _id: { $gt: from, $lt: to } }, { sort: '_id', fields: fields }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length == 0) {
        next([]);
      } else {
        next(bucks);
      }
    });
  });
}

function generateId(tokens) {
  var vid = tokens && tokens.vid || parseInt(Math.random() * 0xffffffff)
    , time = tokens && tokens.time || (new Date()).getTime()
    , vehicle4Bytes = 'number' == typeof vid ? 
      parser.encodeInt(vid, 32, false, true) :
      parser.encode_utf8(vid)
    , time4Bytes = parser.encodeInt(parseInt(time / 1000), 32, true, true)
    , time2Bytes = parser.encodeInt(parseInt(time % 1000), 16, true, true)
    , index2Bytes = parser.encodeInt(this.get_inc16(), 16, false, true)
  ;
  return vehicle4Bytes + time4Bytes + time2Bytes + index2Bytes;
}

// Database Stub

// var DatabaseStub = function () {
//   this.data = [];
// }
// 
// DatabaseStub.prototype.clear = function (fn) {
//   var colls = db.connections[0].collections
//     , collsArray = []
//   ;
//   for (var c in colls)
//     if (colls.hasOwnProperty(c))
//       collsArray.push(colls[c]);
//   var num = collsArray.length
//     , cnt = 0
//   ;
//   collsArray.forEach(function (coll) {
//     coll.drop(function () {
//       sys.puts('dropped ' + coll.name);
//       cnt++;
//       if (cnt == num)
//         fn();
//     });
//   });
// }
//  
// DatabaseStub.prototype.create = function (from, numUsers, res, fn) {
//   if ('function' == typeof res) {
//     fn = res;
//     res = undefined;
//   }
//   this.res = res || 10;
//   var self = this
//     , to = from + '.tmp'
//     , cnt = 0
//   ;
//   
//   self.expand(from, to, function () {
//     self.load(to, function () {
//       fs.unlink(to);
//       insert();
//     });
//   });
//   
//   function insert() {
//     var u = {};
//     u.name = {};
//     u.name.full = data.names[Math.floor(Math.random() * data.names.length)];
//     var user = new User(u);
//     user.save(function (err) {
//       var v = data.cars[Math.floor(Math.random() * data.cars.length)];
//       var vehicle = new Vehicle({
//           model: v[0]
//         , make: v[1]
//         , year: v[2][Math.floor(Math.random() * v[2].length)]
//         , user_id: user._id
//       }, { time: self.oldest - self.res });
//       vehicle.save(function (err) {
//         self.dice(vehicle._id.vid, self.data, 1000, function () {
//           cnt++;
//           if (cnt == numUsers)
//             self.decimate(fn);
//           else
//             insert();
//         });
//       });
//     });
//   }
// }
// 
// DatabaseStub.prototype.expand = function (from, to, fn) {
//   var self = this
//     , d = []
//     , fileout = csv()
//       .toPath(to)
//       .on('end', function () {
//         fn(self.res);
//       })
//   ;
//   csv()
//   .fromPath(from)
//   .on('data', function (data, index) {
//     d.push(data);
//   })
//   .on('end', function (count) {
//     for (var i=0; i < d.length-1; i++) {
//       var t = parseInt(d[i][0]);
//       var tt = parseInt(d[i+1][0]);
//       while (tt - t > self.res) {
//         var r = [];
//         for (var j=0; j < d[i].length; j++)
//           r[j] = d[i][j];
//         r[0] = t.toString();
//         for (var k=0; k < r.length; k++) {
//           fileout.write(r[k], true);
//           if (k != r.length - 1)
//             fileout.write(',', true);
//         }
//         fileout.write('\n', true);
//         t += self.res;
//       }
//     }
//     fileout.end();
//   })
//   .on('error', function (error) {
//     console.log(error.message);
//   });
// }
// 
// DatabaseStub.prototype.load = function (from, fn) {
//   var self = this;
//   csv()
//   .fromPath(from, { columns: ['time','lat','long','alt','speed','acx','acy','acz','soc1','soc2','soc3','bdat1','bdat2','bdat3'] })
//   .on('data', function (data, index) {
//     var sample = {};
//     for (var s in data)
//       if(data.hasOwnProperty(s))
//         data[s] = parseFloat(data[s]);
//     sample.time = parseInt(data.time);
//     delete data.time;
//     sample.duration = self.res;
//     sample.data = data;
//     self.data.push(sample);
//   })
//   .on('end', function (count) {
//     self.oldest = self.data[0].time;
//     self.newst = self.data[count - 1].time;
//     fn();
//   })
//   .on('error', function (error) {
//     console.log(error.message);
//   });
// }
// 
// DatabaseStub.prototype.dice = function (vid, data, into, fn) {
//   var s = 0
//     , bucketDuration = 0
//     , bucket = { samples: [] }
//     , bucketTime
//   ;
//   function dicer() {
//     var sample = data[s];
//     //console.log(sample);
//     bucketDuration += sample.duration;
//     if (bucket.samples.length == 0)
//       bucketTime = sample.time;
//     //if (bucketTime + into <= sample.time) {
//     if (bucketDuration == into) {
//       bucketDuration = 0;
//       var slice = new (eval('Slice' + into))(bucket, { vid: vid, time: bucketTime });
//       slice.save(function (err) {
//         bucket = { samples: [] };
//         bucketTime = sample.time;
//         bucket.samples.push(sample);
//         incer();
//       });
//     } else {
//       bucket.samples.push(sample);
//       incer();
//     }
//   }
//   function incer() {
//     s++;
//     if (s == data.length) {
//       var slice = new (eval('Slice' + into))(bucket, { vid: vid, time: bucketTime });
//       slice.save(function (err) {
//         fn();
//       });
//     } else
//       dicer();
//   }
//   if (data.length != 0)
//     dicer();
//   else
//     fn();
// }
// 
// DatabaseStub.prototype.decimate = function (fn) {
//   var self = this;
//   Vehicle.find({}, function (err, vehs) {
//     if (err || !vehs || vehs.length == 0)
//       fn();
//     else {
//       var num = vehs.length
//         , cnt = 0
//       ;
//       function next() {
//         var v = vehs[cnt];
//         self.average(v._id, 1000, function (data) {
//           self.dice(v._id.vid, data, 20000, function () {
//             self.average(v._id, 20000, function (data) {
//               self.dice(v._id.vid, data, 1000000, function () {
//                 cnt++;
//                 if (cnt == num) {
//                   fn();
//                 } else
//                   next();
//               });
//             });
//           });
//         });
//       }
//       next();
//     }
//   });
// }
// 
// DatabaseStub.prototype.average = function (v_id, from, fn) {
//   var gt = v_id;
//   var lt = new oid(generateId, { vid: v_id.vid, time: (new Date()).getTime() });
//   db.connections[0].collections['slice' + from + 's'].find({ _id: { $gt: gt, $lt: lt } }, function (err, cursor) {
//     cursor.toArray(function (err, bucks) {
//       if (err || !bucks || bucks.length == 0) {
//         console.log('vehicle has no data in Slice' + from);
//         fn();
//       } else {
//         var averaged = [];
//         for (var i=0; i < bucks.length; i++) {
//           var samples = bucks[i].samples
//             , numSamples = samples.length
//             , newSample = {
//                 time: bucks[i]._id.time
//               , duration: 0
//               , _synthetic: true
//               , data: {}
//             }
//           ;
//           for (var j=0; j < numSamples; j++) {
//             newSample.duration += samples[j].duration;
//             for (var p in samples[j].data)
//               if (samples[j].data.hasOwnProperty(p)) {
//                 if (!newSample.data[p])
//                   newSample.data[p] = 0;
//                 newSample.data[p] += (parseFloat(100000 * (samples[j].data[p] * (samples[j].duration / from)))) / 100000;
//               }
//             if (newSample.duration == from)
//               averaged.push(newSample);
//           }
//         }
//         fn(averaged);
//       }
//     });
//   });
// }


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

models.defineModels(mongoose, generateId, function () {
  app.User = User = mongoose.model('User');
  app.Vehicle = Vehicle = mongoose.model('Vehicle');
  app.EventBucket = EventBucket = mongoose.model('EventBucket');
  app.LoginToken = LoginToken = mongoose.model('LoginToken');
  // app.Slice1000 = Slice1000 = mongoose.model('Slice1000');
  // app.Slice20000 = Slice20000 = mongoose.model('Slice20000');
  // app.Slice1000000 = Slice1000000 = mongoose.model('Slice1000000');
  // app.Slice60000000 = Slice60000000 = mongoose.model('Slice60000000');
  // app.Slice3600000000 = Slice3600000000 = mongoose.model('Slice3600000000');
  // app.Slice86400000000 = Slice86400000000 = mongoose.model('Slice86400000000');
  db = mongoose.connectSet(app.set('db-uri'));
});


/////////////// Params


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

app.param('vid', function (req, res, next, id) {
  var to = new oid(generateId, { vid: parseInt(id), time: (new Date()).getTime() })
    , from = new oid(to.toHexString().substr(0,8) + '0000000000000000')
  ;
  Vehicle.collection.findOne({ _id: { $gt: from, $lt: to } }, function (err, veh) {
    if (!err && veh) {
      req.vehicle = veh;
      next();
    } else {
      res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
    }
  });
});


////////////// Web Routes


app.get('/', loadUser, function (req, res) {
  findVehicles(function (vehs) {
    var vehicles = []
      , num = vehs.length
      , cnt = 0
    ;
    vehs.forEach(function (v) {
      findVehicleEvents(v._id, function (bucks) {
        if (bucks.length > 0) {
          vehicles.push(v);
        }
        cnt++;
        if (cnt == num) {
          // vehicles.sort(function (a, b) {
          //   return b[0]._id.time - a[0]._id.time;
          // });
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
  res.render('login');
});

// Get one vehicle
app.get('/v/:vid', function (req, res) {
  findVehicleEvents(req.vehicle._id, function (bucks) {
    res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
  }, true);
});

// Login - add user to session
app.post('/sessions', function (req, res) {
  // check fields
  var missing = [];
  if (!req.body.user.email)
    missing.push('email');
  if (!req.body.user.password)
    missing.push('password');
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
          } else
            res.send({ status: 'success' });
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


// handle user create request
app.post('/usercreate/:newemail', function (req, res) {
  var user = new User({
      email: req.params.newemail
    , name: { full: req.body.fullName }
    , password: req.body.password
  });
  user.save(function (err) {
    if (!err) {
      Notify.welcome(user, function (err, message) {
        if (!err)
          res.send({ status: 'success', data: { user: user } });
        else {
          res.send({ status: 'error', message: err });
          Notify.problem(err);
        }
      });
    } else {
      res.send({ status: 'fail', data: { code: 'DUPLICATE_EMAIL', message: 'This email address is already being used on our system.' } });
    }
  });
});

// handle vehicle create request
app.post('/vehiclecreate/:email/:make/:model/:year', function (req, res) {
  var v = new Vehicle({
      make: req.params.make
    , model: req.params.model
    , year: req.params.year
    , user_id: req.currentUser._id
  });
  v.save(function (err) {
    if (!err) {
      res.send({ status: 'success', data: { vehicleId: v._id.vid } });
    } else {
      res.send({ status: 'error', message: err });
    }
  });
});

// handle user info request
app.get('/userinfo/:email', function (req, res) {
  res.send({ status: 'success', data: { user: req.currentUser } });
});

// handle vehicle info request
app.get('/summary/:email/:vid', function (req, res) {
  if (req.vehicle.user_id.toHexString() == req.currentUser._id.toHexString()) {
    res.send({ status: 'success', data: { user: req.currentUser, vehicle: req.vehicle } });
  } else {
    res.send({ status: 'fail', data: { code: 'VEHICLE_NOT_FOUND' } });
  }
});

// handle cycle events request
app.put('/cycle', function (req, res) {
  if (!(req.body instanceof Buffer)) {
    res.send({ status: 'fail', data: { code: 'BAD_PROTOBUF_FORMAT' } });
    return;
  }
  var cycle = EventWebUpload.parse(new Buffer(req.rawBody, 'binary'))
    , start = cycle.events[0].events[0].header.startTime
    , num = cycle.events.length
    , cnt = 0
  ;
  // authenticate user
  User.findOne({ email: cycle.userId }, function (err, usr) {
    if (usr) {
      if (usr.authenticate(req.body.password)) {
        findVehicle(cycle.vehicleId, function (veh) {
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
      var bucket = new EventBucket(event, { vid: v._id.vid, time: event.events[0].header.startTime });
      bucket.save(function (err) {
        cnt++;
        if (cnt == num)
          res.end();
      });
    });
  }
});

////////////// Listen Up

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(8080);
  console.log("Express server listening on port %d", app.address().port);
}

