
/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
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
  , Slice1000
  , Slice20000
  , Slice1000000
  , Slice60000000
  , Slice3600000000
  , Slice86400000000
  , stub
  , ProtobufSchema = require('protobuf_for_node').Schema
  //, Event = new ProtobufSchema(fs.readFileSync(__dirname + '/proto/Events.desc'))
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/../../mission-java/henson/common/src/main/protobuf/Events.desc'))
  , EventWebUpload = Event['event.EventWebUpload']
  , Stream = require('stream').Stream
;

// Helpers

function findVehicles(next) {
  Vehicle.find({}, [], { limit: 100 }).sort('_id', -1).run(function (err, vehs) {
    var num = vehs.length
      , cnt = 0
    ;
    if (num > 0)
      vehs.forEach(function (veh) {
        User.findById(veh.user_id, function (err, usr) {
          veh.user = usr;
          console.log(veh._id.time);
          cnt++;
          if (cnt == num) {
            vehs.sort(function (a, b) {
              return b._id.time - a._id.time;
            });
            next(vehs);
          }
        });
      });
    else
      next([]);
  });
}

function findVehicleBuckets(id, slice, from, to, next) {
  if ('function' == typeof from) {
    next = from;
    from = 0;
    to = (new Date()).getTime();
  } else if ('function' == typeof to) {
    next = to;
    to = (new Date()).getTime();
  }
  from = from == 0 ? id : new oid(generateId, { vid: id.vid, time: (new Date(from)).getTime() });
  to = new oid(generateId, { vid: id.vid, time: to });
  db.connections[0].collections['slice' + slice + 's'].find({ _id: { $gt: from, $lt: to } }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length == 0) {
        console.log('vehicle has no data in Slice' + slice);
        next([]);
      } else {
        next(bucks);
      }
    });
  });
}

function findVehicleEvents(id, from, to, next) {
  if ('function' == typeof from) {
    next = from;
    from = 0;
    to = (new Date()).getTime();
  } else if ('function' == typeof to) {
    next = to;
    to = (new Date()).getTime();
  }
  from = from == 0 ? id : new oid(generateId, { vid: id.vid, time: (new Date(from)).getTime() });
  to = new oid(generateId, { vid: id.vid, time: to });
  db.connections[0].collections['eventbuckets'].find({ _id: { $gt: from, $lt: to } }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length == 0) {
        console.log('vehicle has no events');
        next([]);
      } else {
        next(bucks);
      }
    });
  });
}


// Utils

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

// Protobuf helpers

// EventStream.prototype.numEvents = function () {
//   return this.events.length;
// };


// Database Stub

var DatabaseStub = function () {
  this.data = [];
}

DatabaseStub.prototype.clear = function (fn) {
  var colls = db.connections[0].collections
    , collsArray = []
  ;
  for (var c in colls)
    if (colls.hasOwnProperty(c))
      collsArray.push(colls[c]);
  var num = collsArray.length
    , cnt = 0
  ;
  collsArray.forEach(function (coll) {
    coll.drop(function () {
      sys.puts('dropped ' + coll.name);
      cnt++;
      if (cnt == num)
        fn();
    });
  });
}
 
DatabaseStub.prototype.create = function (from, numUsers, res, fn) {
  if ('function' == typeof res) {
    fn = res;
    res = undefined;
  }
  this.res = res || 10;
  var self = this
    , to = from + '.tmp'
    , cnt = 0
  ;
  
  self.expand(from, to, function () {
    self.load(to, function () {
      fs.unlink(to);
      insert();
    });
  });
  
  function insert() {
    var u = {};
    u.name = {};
    u.name.full = data.names[Math.floor(Math.random() * data.names.length)];
    var user = new User(u);
    user.save(function (err) {
      var v = data.cars[Math.floor(Math.random() * data.cars.length)];
      var vehicle = new Vehicle({
          model: v[0]
        , make: v[1]
        , year: v[2][Math.floor(Math.random() * v[2].length)]
        , user_id: user._id
      }, { time: self.oldest - self.res });
      vehicle.save(function (err) {
        self.dice(vehicle._id.vid, self.data, 1000, function () {
          cnt++;
          if (cnt == numUsers)
            self.decimate(fn);
          else
            insert();
        });
      });
    });
  }
}

DatabaseStub.prototype.expand = function (from, to, fn) {
  var self = this
    , d = []
    , fileout = csv()
      .toPath(to)
      .on('end', function () {
        fn(self.res);
      })
  ;
  csv()
  .fromPath(from)
  .on('data', function (data, index) {
    d.push(data);
  })
  .on('end', function (count) {
    for (var i=0; i < d.length-1; i++) {
      var t = parseInt(d[i][0]);
      var tt = parseInt(d[i+1][0]);
      while (tt - t > self.res) {
        var r = [];
        for (var j=0; j < d[i].length; j++)
          r[j] = d[i][j];
        r[0] = t.toString();
        for (var k=0; k < r.length; k++) {
          fileout.write(r[k], true);
          if (k != r.length - 1)
            fileout.write(',', true);
        }
        fileout.write('\n', true);
        t += self.res;
      }
    }
    fileout.end();
  })
  .on('error', function (error) {
    console.log(error.message);
  });
}

DatabaseStub.prototype.load = function (from, fn) {
  var self = this;
  csv()
  .fromPath(from, { columns: ['time','lat','long','alt','speed','acx','acy','acz','soc1','soc2','soc3','bdat1','bdat2','bdat3'] })
  .on('data', function (data, index) {
    var sample = {};
    for (var s in data)
      if(data.hasOwnProperty(s))
        data[s] = parseFloat(data[s]);
    sample.time = parseInt(data.time);
    delete data.time;
    sample.duration = self.res;
    sample.data = data;
    self.data.push(sample);
  })
  .on('end', function (count) {
    self.oldest = self.data[0].time;
    self.newst = self.data[count - 1].time;
    fn();
  })
  .on('error', function (error) {
    console.log(error.message);
  });
}

DatabaseStub.prototype.dice = function (vid, data, into, fn) {
  var s = 0
    , bucketDuration = 0
    , bucket = { samples: [] }
    , bucketTime
  ;
  function dicer() {
    var sample = data[s];
    //console.log(sample);
    bucketDuration += sample.duration;
    if (bucket.samples.length == 0)
      bucketTime = sample.time;
    //if (bucketTime + into <= sample.time) {
    if (bucketDuration == into) {
      bucketDuration = 0;
      var slice = new (eval('Slice' + into))(bucket, { vid: vid, time: bucketTime });
      slice.save(function (err) {
        bucket = { samples: [] };
        bucketTime = sample.time;
        bucket.samples.push(sample);
        incer();
      });
    } else {
      bucket.samples.push(sample);
      incer();
    }
  }
  function incer() {
    s++;
    if (s == data.length) {
      var slice = new (eval('Slice' + into))(bucket, { vid: vid, time: bucketTime });
      slice.save(function (err) {
        fn();
      });
    } else
      dicer();
  }
  if (data.length != 0)
    dicer();
  else
    fn();
}

DatabaseStub.prototype.decimate = function (fn) {
  var self = this;
  Vehicle.find({}, function (err, vehs) {
    if (err || !vehs || vehs.length == 0)
      fn();
    else {
      var num = vehs.length
        , cnt = 0
      ;
      function next() {
        var v = vehs[cnt];
        self.average(v._id, 1000, function (data) {
          self.dice(v._id.vid, data, 20000, function () {
            self.average(v._id, 20000, function (data) {
              self.dice(v._id.vid, data, 1000000, function () {
                cnt++;
                if (cnt == num) {
                  fn();
                } else
                  next();
              });
            });
          });
        });
      }
      next();
    }
  });
}

DatabaseStub.prototype.average = function (v_id, from, fn) {
  var gt = v_id;
  var lt = new oid(generateId, { vid: v_id.vid, time: (new Date()).getTime() });
  db.connections[0].collections['slice' + from + 's'].find({ _id: { $gt: gt, $lt: lt } }, function (err, cursor) {
    cursor.toArray(function (err, bucks) {
      if (err || !bucks || bucks.length == 0) {
        console.log('vehicle has no data in Slice' + from);
        fn();
      } else {
        var averaged = [];
        for (var i=0; i < bucks.length; i++) {
          var samples = bucks[i].samples
            , numSamples = samples.length
            , newSample = {
                time: bucks[i]._id.time
              , duration: 0
              , _synthetic: true
              , data: {}
            }
          ;
          for (var j=0; j < numSamples; j++) {
            newSample.duration += samples[j].duration;
            for (var p in samples[j].data)
              if (samples[j].data.hasOwnProperty(p)) {
                if (!newSample.data[p])
                  newSample.data[p] = 0;
                newSample.data[p] += (parseFloat(100000 * (samples[j].data[p] * (samples[j].duration / from)))) / 100000;
              }
            if (newSample.duration == from)
              averaged.push(newSample);
          }
        }
        fn(averaged);
      }
    });
  });
}


// Configuration

var app = module.exports = express.createServer();
app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  express.bodyParser.parse['application/octet-stream'] = Buffer;
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
  app.set('db-uri', 'mongodb://localhost:27017/service-development,mongodb://localhost:27018,mongodb://localhost:27019');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('test', function () {
  app.set('db-uri', 'mongodb://localhost:27017/service-test,mongodb://localhost:27018,mongodb://localhost:27019');
});

app.configure('production', function () {
  app.set('db-uri', 'mongodb://domU-12-31-39-13-E0-35.compute-1.internal:27017/service-production,mongodb://domU-12-31-39-0A-AD-F9.compute-1.internal:27017,mongodb://domU-12-31-39-15-3D-CF.compute-1.internal:27017');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  //app.use(express.errorHandler()); 
});

models.defineModels(mongoose, generateId, function () {
  app.User = User = mongoose.model('User');
  app.Vehicle = Vehicle = mongoose.model('Vehicle');
  app.EventBucket = EventBucket = mongoose.model('EventBucket');
  app.Slice1000 = Slice1000 = mongoose.model('Slice1000');
  app.Slice20000 = Slice20000 = mongoose.model('Slice20000');
  app.Slice1000000 = Slice1000000 = mongoose.model('Slice1000000');
  app.Slice60000000 = Slice60000000 = mongoose.model('Slice60000000');
  app.Slice3600000000 = Slice3600000000 = mongoose.model('Slice3600000000');
  app.Slice86400000000 = Slice86400000000 = mongoose.model('Slice86400000000');
  db = mongoose.connectSet(app.set('db-uri'));
});


// Params

app.param('vid', function (req, res, next, id) {
  var to = new oid(generateId, { vid: parseInt(id), time: (new Date()).getTime() })
    , from = new oid(to.toHexString().substr(0,8) + '0000000000000000')
  ;
  db.connections[0].collections.vehicles.findOne({ _id: { $gt: from, $lt: to } }, function (err, veh) {
    if (!err && veh)
      req.vehicle = veh;
    next();
  });
});


// Routes

app.get('/', function (req, res) {
  findVehicles(function (vehs) {
    res.render('index', {
      data: vehs
    });
  });
});

app.get('/v/:vid', function (req, res) {
  findVehicleEvents(req.vehicle._id, function (bucks) {
    res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
  });
  // findVehicleBuckets(req.vehicle._id, 1000000, function (bucks) {
  //   res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
  // });
});


// get vehicle
function findVehicle(id, next) {
  var to = new oid(generateId, { vid: id, time: (new Date()).getTime() })
    , from = new oid(to.toHexString().substr(0,8) + '0000000000000000')
  ;
  db.connections[0].collections.vehicles.findOne({ _id: { $gt: from, $lt: to } }, function (err, veh) {
    if (!err)
      next(veh);
  });
}

app.put('/cycle', function (req, res) {
  if (!(req.body instanceof Buffer)) {
    res.end();
    return;
  }
  var cycle = EventWebUpload.parse(new Buffer(req.rawBody, 'binary'))
    , start = cycle.events[0].events[0].header.startTime
    , num = cycle.events.length
    , cnt = 0
  ;
  
  findVehicle(cycle.vehicleId, function (veh) {
    if (!veh) {
      var u = {};
      u.name = {};
      u.name.full = data.names[Math.floor(Math.random() * data.names.length)];
      var user = new User(u);
      user.save(function (err) {
        var v = data.cars[Math.floor(Math.random() * data.cars.length)];
        var veh = new Vehicle({
            model: v[0]
          , make: v[1]
          , year: v[2][Math.floor(Math.random() * v[2].length)]
          , user_id: user._id
        }, { vid: cycle.vehicleId, time: start - 1 });
        veh.save(function (err) {
          handleEvents(veh);
        });
      });
    } else {
      handleEvents(veh);
    }
  });
  // add to db
  function handleEvents(veh) {
    cycle.events.forEach(function (event) {
      var bucket = new EventBucket(event, { vid: veh._id.vid, time: event.events[0].header.startTime });
      bucket.save(function (err) {
        cnt++;
        if (cnt == num)
          res.end();
      });
    });
  }
});

// Only listen on $ node app.js

if (!module.parent) {
  stub = new DatabaseStub();
  //stub.clear(function () {
    //stub.create(__dirname + '/cycle.csv', 1, 100, function () {
      app.listen(8080);
      console.log("Express server listening on port %d", app.address().port);
    //});
  //});
}

