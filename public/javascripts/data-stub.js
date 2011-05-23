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