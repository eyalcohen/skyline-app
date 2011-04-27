
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
  , Event = new ProtobufSchema(fs.readFileSync(__dirname + '/proto/Events.desc'))
  , EventStream = Event['event.EventStream']
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
          cnt++;
          if (cnt == num)
            next(vehs);
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

EventStream.prototype.numEvents = function () {
  return this.events.length;
};


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
  express.bodyParser.parse['application/octet-stream'] = EventStream.parse;
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
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
  db = mongoose.connect(app.set('db-uri'));
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
  // findVehicleEvents(req.vehicle._id, function (bucks) {
  //   res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
  // });
  
  findVehicleBuckets(req.vehicle._id, 1000000, function (bucks) {
    res.send({ status: 'success', data: { vehicle: req.vehicle, bucks: bucks } });
  });
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

app.get('/test', function (req, res) {
  res.render('buff');
});


app.put('/cycle', function (req, res) {
  // var theEvent = EventStream.parse(fs.readFileSync('./proto/sample-put-payload.bin'));
  //console.log(res);
  if (!(req.body instanceof Buffer)) {
    res.end();
    //res.send(fs.readFileSync('./proto/sample-put-payload.bin'));
    return;
  }
  // get or make vehicle
  findVehicle(req.body.vehicleId, function (veh) {
    if (!veh) {
      // make a new user and vehicle
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
        }, { vid: req.body.vehicleId, time: req.body.events[0].header.startTime - 1 });
        veh.save(function (err) {
          handleEvents(veh);
        });
      });
    } else {
      // add to existing vehicle
      handleEvents(veh);
    }
  });
  // add to db
  function handleEvents(veh) {
    var bucket = new EventBucket(req.body, { vid: veh._id.vid, time: req.body.events[0].header.startTime });
    bucket.save(function (err) {
      res.end();
      //res.send({ event: veh });
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







// var http = require('http');
// 
// 
// var server = http.createServer(function (req, res) {
//   handle_events(req, res);
// }).listen(8000);


function handle_events(req, res) {
  req.setEncoding(null);

  console.log(res);

  // var stream = new multipart.Stream(req);
  // stream.addListener('part', function(part) {
  //   part.addListener('body', function(chunk) {
  //     var progress = (stream.bytesReceived / stream.bytesTotal * 100).toFixed(2);
  //     var mb = (stream.bytesTotal / 1024 / 1024).toFixed(1);
  // 
  //     sys.print("Uploading "+mb+"mb ("+progress+"%)\015");
  // 
  //     // chunk could be appended to a file if the uploaded file needs to be saved
  //   });
  // });
  // stream.addListener('complete', function() {
  //   res.sendHeader(200, {'Content-Type': 'text/plain'});
  //   res.sendBody('Thanks for playing!');
  //   res.finish();
  //   sys.puts("\n=> Done");
  // });
}





// var options = {
//   host: 'localhost',
//   port: 1337,
//   path: '/',
//   method: 'PUT'
// };
// 
// var test_req = http.request(options, function (res) {
//   //console.log('STATUS: ' + res.statusCode);
//   //console.log('HEADERS: ' + JSON.stringify(res.headers));
//   //res.setEncoding(null);
//   //res.on('data', function (chunk) {
//     //console.log('BODY: ' + chunk);
//     //var theEvent = EventStream.parse(chunk);
//     //console.log(theEvent);
//   //});
// });

//test_req.write(fs.readFileSync('./proto/sample-put-payload.bin'));
//req.write('data\n');
//test_req.end();







// var net = require('net');
// var server = net.createServer(function (socket) {
//   socket.write('hello\r\n');
//   socket.pipe(socket);
// });
// server.listen(1337, '127.0.0.1');


