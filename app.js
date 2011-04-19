// TODO: check number of samples adding to bucket... process higher level buckets.
// add multiple cycles per vehicle... and spread them out randomly -- NOPE, not needed


/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  , fs = require('fs')
  , sys = require('sys')
  , csv = require('csv')
  , parser = require('mongoose/support/node-mongodb-native/lib/mongodb').BinaryParser
  , oid = require('mongoose/lib/mongoose/types/objectid')
  , data = require('./data')
  , models = require('./models')
  , db
  , Slice1000
  , Slice20000
  , Slice1000000
  , Slice60000000
  , Slice3600000000
  , Slice86400000000
  , vehicles = []
  , stub
;

var app = module.exports = express.createServer();

// Configuration

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
  app.set('db-uri', 'mongodb://localhost/stub-development');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('test', function () {
  app.set('db-uri', 'mongodb://localhost/stub-test');
});

app.configure('production', function () {
  app.set('db-uri', 'mongodb://localhost/stub-production');
  app.use(express.errorHandler()); 
});

models.defineModels(mongoose, parser, generateId, function () {
  app.User = User = mongoose.model('User');
  app.Vehicle = Vehicle = mongoose.model('Vehicle');
  app.Slice1000 = Slice1000 = mongoose.model('Slice1000');
  app.Slice20000 = Slice20000 = mongoose.model('Slice20000');
  app.Slice1000000 = Slice1000000 = mongoose.model('Slice1000000');
  app.Slice60000000 = Slice60000000 = mongoose.model('Slice60000000');
  app.Slice3600000000 = Slice3600000000 = mongoose.model('Slice3600000000');
  app.Slice86400000000 = Slice86400000000 = mongoose.model('Slice86400000000');
  db = mongoose.connect(app.set('db-uri'));
});

// Params

app.param('vehId', function (req, res, next, id) {
  var num = vehicles.length
    , cnt = 0
  ;
  vehicles.forEach(function (v) {
    if (v.id == id) {
      req.veh = v;
      next();
      return;
    }
    cnt++;
    if(cnt == num)
      return next(new Error('Failed to find Vehicle'));
  });
});

app.param('vid', function (req, res, next, id) {
  Vehicle.findById(id, function (err, veh) {
    if (err) return next(err);
    if (!veh) return next(new Error('Failed to find Vehicle'));
    req.vehicle = veh;
    next();
  });
});


function findVehicles(next) {
  Vehicle.find({}, function (err, vehs) {
    var num = vehs.length
      , cnt = 0
    ;
    if (num > 0)
      vehs.forEach(function (v) {
        User.findById(v.user_id, function (err, u) {
          v.user = u;
          cnt++;
          if (cnt == num)
            next(vehs);
        });
      });
    else
      next([]);
  });
}

function findVehicleFromBucketId(id, next) {
  //var upper = new oid(generateBucketId, { vid: vehicle._id.vid, time: 1288730398000 });
  //var lower = new oid(generateBucketId, { vid: vehicle._id.vid, time: 1288730715000 });

  //console.log(upper.toHexString(), lower.toHexString());

  //Slice20000.find({})
}

// Routes

app.get('/', function (req, res) {
  res.render('index', {
    data: vehicles
  });
});

app.get('/v', function (req, res) {
  findVehicles(function (vehicless) {
    res.render('indexx', {
      data: vehicless
    });
  });
});

app.get('/cycles/:vehId', function (req, res) {
  var num = req.veh.cycles.length
    , cnt = 0
  ;
  req.veh.cycles.forEach(function (c) {
    delete c.slice;
    cnt++;
    if (cnt == num - 1) {
      res.render('vehicle', {
        data: req.veh
      });
    }
  });
});

app.get('/v/:vid', function (req, res) {
  var cycles = []
    , num = Math.random() * 10
    , i = 0
  ;
  
  function make() {
    var off = Math.round(Math.random() * 1000 * 60 * 60 * 7)
      , dur = Math.round(Math.random() * 1000 * 60 * 60 / 100) * 100
      , end = j > 0 ? cycles[j - 1].end - off : new Date(new Date() - off).valueOf()
      , start = end - dur
      , cur = start
      , t = 0
      , dur = 100
      , d = data.LA4
      , slice = []
    ;
    while (cur <= end) {
      if (Math.ceil(t) > d.length - 1)
        t = 0;
      var speed = (t % 1) * d[Math.floor(t)][1] + (1 - t % 1) * d[Math.ceil(t)][1];
      speed = Math.round(10 * speed) / 10;
      slice.push([ cur, speed ]);
      cur += dur;
      t += 0.1;
    }
    i++;
    if (i == num)
      res.render('vehicle', {
        data: req.vehicle
      });
    else
      make();
  }
    //cycles.push({ start: start, end: end , slice: slice });
});






function makeStub(fn) {
  for (i=0; i < 5; i++) {
    var v = data.cars[Math.floor(Math.random() * data.cars.length)]
      , name = v[2][Math.floor(Math.random() * v[2].length)] + ' ' + v[1] + ' ' + v[0]
      , id = makeKey(4)
      , cycles = []
      , numCycles = Math.random() * 10
    ;
    for (var j=0; j < numCycles; j++) {
      var off = Math.round(Math.random() * 1000 * 60 * 60 * 7)
        , dur = Math.round(Math.random() * 1000 * 60 * 60 / 100) * 100
        , end = j > 0 ? cycles[j - 1].end - off : new Date(new Date() - off).valueOf()
        , start = end - dur
        , cur = start
        , t = 0
        , dur = 100
        , d = data.LA4
        , slice = []
      ;
      while (cur <= end) {
        if (Math.ceil(t) > d.length - 1)
          t = 0;
        var speed = (t % 1) * d[Math.floor(t)][1] + (1 - t % 1) * d[Math.ceil(t)][1];
        speed = Math.round(10 * speed) / 10;
        slice.push([ cur, speed ]);
        cur += dur;
        t += 0.1;
      }
      cycles.push({ start: start, end: end , slice: slice });
    }
    vehicles.push({ id: id, name: name, cycles: cycles.reverse() });
  }
  fn();
}

/**
 * DatabaseStub Object.
 */

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

// Utils

function makeKey(l) {
  var text = "";
  var possible = "0123456789";
  for( var i=0; i < l; i++ )
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

function generateId(tokens) {
  var vid = tokens && tokens.vid || parseInt(Math.random() * 0xffffffff);
  var time = tokens && tokens.time || (new Date()).getTime();
  var vehicle4Bytes = parser.encodeInt(vid, 32, false, true);
  var time4Bytes = parser.encodeInt(parseInt(time / 1000), 32, true, true);
  var time2Bytes = parser.encodeInt(parseInt(time % 1000), 16, true, true);
  var index2Bytes = parser.encodeInt(this.get_inc16(), 16, false, true);
  return vehicle4Bytes + time4Bytes + time2Bytes + index2Bytes;
}



// Only listen on $ node app.js

if (!module.parent) {
  //stub = new DatabaseStub();
  //stub.clear(function () {
    //stub.create(__dirname + '/cycle.csv', 1, function () {
      app.listen(3000);
      console.log("Express server listening on port %d", app.address().port);
    //});
  //});
}



//console.log(vehicle.time, vehicle.vehicle);
// for (i=0; i < 5; i++) {
//   var cycles = []
//     , numCycles = Math.random() * 10
//   ;
//   for (var j=0; j < numCycles; j++) {
//     var off = Math.round(Math.random() * 1000 * 60 * 60 * 7)
//       , dur = Math.round(Math.random() * 1000 * 60 * 60 / 100) * 100
//       , end = j > 0 ? cycles[j - 1].end - off : new Date(new Date() - off).valueOf()
//       , start = end - dur
//       , cur = start
//       , t = 0
//       , dur = 100
//       , d = data.LA4
//       , slice = []
//     ;
//     while (cur <= end) {
//       if (Math.ceil(t) > d.length - 1)
//         t = 0;
//       var speed = (t % 1) * d[Math.floor(t)][1] + (1 - t % 1) * d[Math.ceil(t)][1];
//       speed = Math.round(10 * speed) / 10;
//       slice.push([ cur, speed ]);
//       cur += dur;
//       t += 0.1;
//     }
//     cycles.push({ start: start, end: end , slice: slice });
//   }
//   vehicles.push({ id: id, name: name, cycles: cycles.reverse() });
// }
