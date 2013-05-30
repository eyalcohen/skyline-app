#!/usr/bin/env node
/*
 * main.js: Entry point for the Skyline app.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 8080)
    .describe('dburi', 'MongoDB URI to connect to')
      .default('dburi', 'mongodb://localhost:27017/service-samples')
    .describe('index', 'Ensure indexes on MongoDB collections'
        + '(always `true` in production)')
      .boolean('index')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var http = require('http');
var connect = require('connect');
var express = require('express');
var jade = require('jade');
var mongodb = require('mongodb');
var socketio = require('socket.io');
var redis = require('redis');
var RedisStore = require('connect-redis')(express);
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var color = require('cli-color');

var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var LocalStrategy = require('passport-local').Strategy;

// var Notify = require('./notify');
var UserDb = require('./user_db.js').UserDb;
var SampleDb = require('./sample_db.js').SampleDb;
var Client = require('./lib/client.js').Client;
var compatibility = require('./compatibility.js');

// Setup Environments
var app = express();

// App port is env var in production
app.set('PORT', process.env.PORT || argv.port);

Step(
  function () {

    // Development only
    if ('development' === app.get('env')) {

      // App params
      app.set('MONGO_URI', argv.dburi);
      app.set('REDIS_HOST', 'localhost');
      app.set('REDIS_PORT', 6379);

      // Redis connect
      this(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST')));
    }

    // Production only
    if ('production' === app.get('env')) {

      // App params
      app.set('MONGO_URI', argv.dburi);
      app.set('REDIS_HOST', 'localhost');
      app.set('REDIS_PORT', 6379);
      app.set('REDIS_PASS', 'TODO');

      // Redis connect
      var rc = redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST'));
      rc.auth(app.get('REDIS_PASS'), _.bind(function (err) {
        this(err, rc);
      }, this));
    }

  },
  function (err, rc) {
    if (err) return util.error(err);

    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.set('sessionStore', new RedisStore({client: rc, maxAge: 2592000000}));
    app.use(express.favicon(__dirname + '/public/gfx/favicon.ico'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({
      store: app.get('sessionStore'),
      secret: 'hummmcycles',
      key: 'express.sid'
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.methodOverride());

    // Development only
    if ('development' === app.get('env')) {
      app.use(express.static(__dirname + '/public'));
      app.use(app.router);
      app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
    }

    // Production only
    if ('production' === app.get('env')) {
      app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
      app.use(app.router);
      app.use(express.errorHandler());
    }

    var userDb, sampleDb;

    if (!module.parent) {

      Step(

        // Connect to SampleDb:
        function () {

          // Create db connection.
          util.log('Connecting to SampleDb: ' + app.get('MONGO_URI'));
          mongodb.connect(app.get('MONGO_URI'), {server: {poolSize: 4}}, this);

        }, function (err, db) {
          if (err) return this(err);

          // Create db wrappers.
          var ei = 'production' === app.get('env') || argv.index;
          new UserDb(db, {ensureIndexes: ei}, this.parallel());
          new SampleDb(db, {ensureIndexes: ei}, this.parallel());

        }, function (err, _userDb, _sampleDb) {
          if (err) return this(err);

          // Safe refs.
          userDb = _userDb;
          sampleDb = _sampleDb;

          this();
        },

        // Listen:
        function (err) {
          if (err) {
            util.error(err);
            process.exit(1);
            return;
          }

          // Wire up HTTP routes.
          routes();

          // HTTP server
          var server = http.createServer(app);
          
          // Socket handling
          var io = socketio.listen(server);
          io.set('log level', 1);


          // Configure sockets
          // io.sockets.on('connection', function (socket) {

          //   socket.client = new Client(socket, userDb, sampleDb);

          //   socket.on('authorize', function (cb) {
          //     console.log(socket.client);
          //     cb({dude: 'yes'})

          //   })
          // });

          
          io.set('authorization', function (data, cb) {
            if (data.headers.cookie) {
              console.log(connect.utils)
              data.cookie = connect.utils.parseCookie(data.headers.cookie);
              data.sessionID = data.cookie['express.sid'];

              // save the session store to the data object 
              // (as required by the Session constructor)
              data.sessionStore = app.get('sessionStore');
              sessionStore.get(data.sessionID, function (err, session) {
                if (err || !session) return cb('Error', false);

                // Create a session object, passing data as request and our
                // just acquired session data
                data.session =
                    new connect.middleware.session.Session(data, session);
                cb(null, true);
              });
            } else return cb('No cookie transmitted.', false);
          });

          // Start server
          server.listen(app.get('PORT'));

          io.sockets.on('connection', function (socket) {
            var hs = socket.handshake;
            util.log('A socket with sessionID ' + hs.sessionID
                + ' connected!');

            // Setup an inteval that will keep our session fresh
            var intervalID = setInterval(function () {

              // Reload the session (just in case something changed,
              // we don't want to override anything, but the age)
              // reloading will also ensure we keep an up2date copy
              // of the session with our connection.
              hs.session.reload(function () { 

                // "touch" it (resetting maxAge and lastAccess)
                // and save it back again.
                hs.session.touch().save();
              });
            }, 60 * 1000);

            socket.on('disconnect', function () {
              console.log('A socket with sessionID ' + hs.sessionID 
                  + ' disconnected!');

              // clear the socket interval to stop refreshing the session
              clearInterval(intervalID);
            });
         
          });

          util.log('Web server listening on port ' + app.get('PORT'));
        }
      );

    }
  }

);

// TODO: make own file.
function routes() {

  // Passport session stuff
  passport.serializeUser(function (user, cb) {
    cb(null, user._id.toString());
  });
  passport.deserializeUser(function (id, cb) {
    userDb.findUserById(id, function (err, user) {
      if (!user) user = {};
      cb(err, user);
    });
  });

  passport.use(new LocalStrategy(
    function (email, password, done) {
      userDb.collections.users.findOne({ primaryEmail: email },
                                      function (err, user) {
        if (err) return done(err);
        if (!user) return done(null, false);
        if ('local' !== user.provider)
          return done(null, false);
        if (!UserDb.authenticateLocalUser(user, password))
          return done(null, false);
        return done(null, user);
      });
    }
  ));

  // Set up Google login strategy.
  // Horrible hack: we don't know the right URLs to use until we see a request,
  // so fill them in with dummy values for now, and fill them in for real
  // in app.get('/auth/google', ...).
  passport.use(new GoogleStrategy({
    returnURL: 'http://www.google.com/#q=Why+is+skyline+banned', realm: null
  }, function (identifier, profile, done) {
      profile.provider = 'google';
      userDb.findOrCreateUserFromPrimaryEmail(profile, function (err, user) {
        done(err, user);
      });
    }
  ));

  // Home
  app.get('/', function (req, res) {
    res.render('index');
  });

  // Basic password authentication
  app.post('/login', function (req, res, next) {
    var referer = req.headers.referer;
    passport.authenticate('local', {
      successRedirect: referer,
      failureRedirect: referer + '#oops'
    })(req, res, next);
  });


  // Redirect the user to Google for authentication.
  // When complete, Google will redirect the user
  // back to the application at /auth/google/return.
  app.get('/auth/google', function (req, res, next) {
    // Add referer to session so we can use it on return.
    // This way we can preserve query params in links.
    req.session.referer = req.headers.referer;

    // Hack: fill in returnUrl and realm for google auth.
    var myUrl = url.parse(req.headers.referer);
    myUrl.search = myUrl.query = myUrl.hash = null;
    myUrl.pathname = '/auth/google/return';
    var returnUrl = url.format(myUrl);
    myUrl.pathname = '/';
    var realm = url.format(myUrl);
    log('passport: ' + inspect(passport));
    log("passport._strategies['google']: " +
        inspect(passport._strategies['google']));
    log('returnUrl: ' + returnUrl);
    log('realm: ' + realm);
    passport._strategies['google']._relyingParty.returnUrl = returnUrl;
    passport._strategies['google']._relyingParty.realm = realm;
    log('passport: ' + inspect(passport));
    log("passport._strategies['google']: " +
        inspect(passport._strategies['google']));

    passport.authenticate('google')(req, res, next);
  });


  // Google will redirect the user to this URL
  // after authentication. Finish the process by
  // verifying the assertion. If valid, the user will be
  // logged in. Otherwise, authentication has failed.
  app.get('/auth/google/return', function (req, res, next) {
    passport.authenticate('google', {
      successRedirect: req.session.referer || '/',
      failureRedirect: req.session.referer || '/'
    })(req, res, next);
  });

  // Log out
  app.get('/logout', function (req, res) {
    req.logOut();
    res.redirect('/');
  });

  // Go home
  app.get('/vehicle', function (req, res) {
    res.redirect('/');
  });

  // Allows sharing by vehicle
  app.get('/vehicle/:id', function (req, res) {
    res.render('index');
  });

  // Alias to above
  app.get('/s/:key', function (req, res) {
    userDb.collections.links.findOne({key: req.params.key},
        function (err, link) {
      res.redirect('/?' + (err || !link ? '' : link.val));
    });
  });

}






































// /////////////// Helpers

// /**
//  * Wraps a callback f to simplify error handling.  Specifically, this:
//  *   asyncFunction(..., errWrap(cb, function (arg) {
//  *     ...
//  *     cb(...);
//  *   }));
//  * is equivalent to:
//  *   asyncFunction(..., function (err, arg) {
//  *     if (err) { cb(err); return; }
//  *     try {
//  *       ...
//  *       cb(...);
//  *     } catch (err2) {
//  *       cb(err2);
//  *     }
//  *   }));
//  */
// function errWrap(next, f) {
//   return function (err) {
//     if (err) { next(err); return; }
//     try {
//       f.apply(this, Array.prototype.slice.call(arguments, 1));
//     } catch (err) {
//       next(err);
//     }
//   }
// }

// function requestMimeType(req) {
//   return (req.headers['content-type'] || '').split(';')[0];
// }




// ////////////// API


// // Export as CSV for webapp.
// app.get('/export/:vintid/data.csv', function (req, res, next) {
//   // TODO: access control.
//   // TODO: verify vehicle.

//   function numParam(name, required) {
//     var v = req.query[name];
//     if (!v && required)
//       throw new Error('Parameter ' + name + ' is required.');
//     if (!v) return null;
//     var n = Number(v);
//     if (isNaN(n))
//       throw new Error('Parameter ' + name + ': "' + v + '" is not a number.');
//     return n;
//   }

//   // Parameters available in query URL:
//   //   beg=<beginTime>,end=<endTime> Time range to fetch.
//   //   resample=<resolution> Resample data to provided duration.
//   //   minDuration=<duration> Approximate minimum duration to fetch.
//   //   minmax Include minimum and maximum values.
//   //   chan=<name1>,chan=<name2>,... Channels to fetch.
//   // There are a few special channels:
//   //   $beginDate: Begin date, e.g. '2011-09-06'.
//   //   $beginTime: Begin time, e.g. '16:02:23'.
//   //   $beginAbsTime: Begin time in seconds since epoch, e.g. 1309914166.385.
//   //   $beginRelTime: Begin time in seconds since first sample, e.g. 6.385.
//   //   $endDate/$endTime/$endAbsTime/$endRelTime: End time.
//   //   $duration: Duration in seconds, e.g. '0.01234'.
//   // Example: curl 'http://localhost:8080/export/1772440972/data.csv?beg=1309914019674000&end=1309916383000000&chan=$beginDate&chan=$beginTime&chan=$beginAbsTime&chan=$duration&chan=$beginRelTime&chan=$endRelTime&chan=gps.speed_m_s&chan=gps.latitude_deg&chan=gps.longitude_deg&chan=gps.altitude_m&chan=accel.x_m_s2&minDuration=10000000&minmax'
//   try {
//     var vehicleId = Number(req.params.vintid);
//     var resample = numParam('resample');
//     var beginTime = numParam('beg', resample != null);
//     var endTime = numParam('end', resample != null);
//     var minDuration = numParam('minDuration');
//     if (resample != null && minDuration == null)
//       minDuration = Math.ceil(resample / 4);
//     var getMinMax = 'minmax' in req.query;
//     var channels = req.query.chan || [];
//     if (_.isString(channels)) channels = [channels];
//     if (!channels.length || (resample != null && resample < 1))
//       return next('BAD_PARAM');  // TODO: better error
//   } catch (err) {
//     return next(err.toString());
//   }

//   res.contentType('.csv');
//   var csv = CSV().toStream(res, { lineBreaks: 'windows', end: false });
//   var schema = {};
//   var sampleSet = {};
//   var samplesSplit;
//   Step(
//     function fetchData() {
//       var parallel = this.parallel;
//       // Fetch channels.
//       channels.forEach(function (channelName) {
//         if (channelName[0] === '$') return;
//         var next = parallel();
//         var fetchOptions = {
//           beginTime: beginTime, endTime: endTime,
//           minDuration: minDuration, getMinMax: getMinMax
//         };
//         sampleDb.fetchSamples(vehicleId, channelName, fetchOptions,
//                               errWrap(next, function (samples) {
//           if (resample != null)
//             samples = SampleDb.resample(samples, beginTime, endTime, resample);
//           sampleSet[channelName] = samples;
//           next();
//         }));
//       });
//       // Fetch schema.
//       { var next = parallel();
//         var fetchOptions = { beginTime: beginTime, endTime: endTime };
//         sampleDb.fetchSamples(vehicleId, '_schema', fetchOptions,
//                               errWrap(next, function (samples) {
//           samples.forEach(function (sample) {
//             schema[sample.val.channelName] = sample;
//           });
//           next();
//         }));
//       }
//     },

//     function reorganize(err) {
//       if (err)
//         log('Error during CSV sample fetch: ' + err + '\n' + err.stack);
//       samplesSplit = SampleDb.splitSamplesByTime(sampleSet);
//       this();
//     },

//     function writeData(err) {
//       if (err) return this(err);

//       // Write UTF-8 signature, so that Excel imports CSV as UTF-8.
//       // Unfortunately, this doesn't seem to work with all Excel versions.  Boo.
//       //res.write(new Buffer([0xEF, 0xBB, 0xBF]));

//       // Write header.
//       var header = [];
//       var specialRE = /^\$(begin|end)(Date|Time|AbsTime|RelTime)$/;
//       channels.forEach(function (channelName) {
//         var m = channelName.match(specialRE);
//         if (m) {
//           header.push(
//               (m[1] === 'end' ? 'End ' : 'Begin ') +
//               (m[2] === 'Date' ? 'Date' :
//                m[2] === 'Time' ? 'Time' :
//                m[2] === 'AbsTime' ? 'Since 1970 (s)' :
//                m[2] === 'RelTime' ? 'Since Start (s)' : ''));
//         } else if (channelName === '$duration') {
//           header.push('Duration (s)');
//         } else {
//           var channelSchema = schema[channelName];
//           var description = channelName;
//           if (channelSchema && channelSchema.val.humanName)
//             description = channelSchema.val.humanName;
//           if (channelSchema && channelSchema.val.units)
//             description += ' (' + channelSchema.val.units + ')';
//           header.push(description);
//           if (getMinMax) {
//             header.push('min');
//             header.push('max');
//           }
//         }
//       });
//       csv.write(header);

//       // Write data.
//       var firstBeg = null;
//       samplesSplit.forEach(function (sampleGroup) {
//         var beg = sampleGroup.beg, end = sampleGroup.end;
//         if (firstBeg == null) firstBeg = beg;
//         // TODO: What about time zones?
//         // See zoneinfo npm and
//         //   https://bitbucket.org/pellepim/jstimezonedetect/wiki/Home
//         // TOOD: i18n?
//         var date = new Date(beg / 1000);
//         var line = [];
//         channels.forEach(function (channelName) {
//           var m = channelName.match(specialRE);
//           if (m) {
//             var t = (m[1] === 'end' ? end : beg), d = new Date(t / 1e3);
//             line.push(
//                 m[2] === 'Date' ?
//                     _.sprintf('%d-%02d-%02d',
//                               d.getFullYear(), d.getMonth() + 1, d.getDate()) :
//                 m[2] === 'Time' ?
//                     _.sprintf('%02d:%02d:%02d',
//                               d.getHours(), d.getMinutes(), d.getSeconds()) :
//                 m[2] === 'AbsTime' ? t / 1e6 :
//                 m[2] === 'RelTime' ? (t - firstBeg) / 1e6 : '');
//           } else if (channelName === '$duration') {
//             line.push((end - beg) / 1e6);
//           } else {
//             var s = sampleGroup.val[channelName];
//             var val = (s == null ? '' : s.val);
//             if (!(_.isNumber(val) || _.isString(val)))
//               val = util.inspect(val);
//             line.push(val);
//             if (getMinMax) {
//               line.push(s == null || s.min == null ? '' : s.min);
//               line.push(s == null || s.max == null ? '' : s.max);
//             }
//           }
//         });
//         csv.write(line);
//       });

//       csv.write([]); // Make sure there's a terminating newline.
//       csv.end();
//       res.end();
//     },

//     next
//   );
// });


// // Create a user
// app.post('/create/user/:email', function (req, res) {
//   var props = {
//     primaryEmail: req.params.email,
//     emails: [ { value: req.params.email } ],
//     displayName: req.body.fullName,
//     password: req.body.password,
//     provider: 'local',
//   };
//   userDb.findOrCreateUserFromPrimaryEmail(props, function (err, user) {
//     if (err) return res.send({ status: 'error', message: err }, 400);
//     res.send({ status: 'success', data: user });
//   });
// });


// // Create a vehicle
// // ** In practice, this route is only ever
// // used by a new client, e.g., a tablet,
// // when it's initializing itself. We pass
// // back a unique vehicleId to use when uploading
// // samples for a specific vehicle in our database
// // and a clientId that the the server can use
// // for authentication.
// app.post('/create/vehicle/:title/:description/:nickname',
//     function (req, res) {
//   var props = {
//     title: req.params.title,
//     description: req.params.description,
//     nickname: req.params.nickname,
//   };
//   userDb.createVehicle(props, function (err, veh) {
//     if (err)
//       res.send({ status: 'error', message: err }, 400);
//     else
//       res.send({ status: 'success', data: {
//               vehicleId: veh._id, clientId: veh.clientId } });
//   });
// });

// // Create a team
// app.post('/create/team/:title/:description/:nickname/:domains/:users/:admins',
//     function (req, res) {
//   var props = {
//     title: req.params.title,
//     description: req.params.description,
//     nickname: req.params.nickname,
//     domains: req.params.domains !== 'null' ?
//         req.params.domains.split(',') : [],
//     users: req.params.users !== 'null' ?
//         _.map(req.params.users.split(','),
//               function (v) { return Number(v); }) : [],
//     admins: req.params.admins !== 'null' ?
//         _.map(req.params.admins.split(','),
//               function (v) { return Number(v); }) : [],
//     vehicles: [],
//     fleets: [],
//   };
//   userDb.createTeam(props, function (err, team) {
//     if (err)
//       res.send({ status: 'error', message: err }, 400);
//     else
//       res.send({ status: 'success', data: { teamId: team._id } });
//   });
// });

// // Create a fleet
// app.post('/create/fleet/:title/:description/:nickname/:vehicles',
//     function (req, res) {
//   var props = {
//     title: req.params.title,
//     description: req.params.description,
//     nickname: req.params.nickname,
//     vehicles: req.params.vehicles !== 'null' ?
//         _.map(req.params.vehicles.split(','),
//               function (v) { return Number(v); }) : [],
//   };
//   userDb.createFleet(props, function (err, fle) {
//     if (err)
//       res.send({ status: 'error', message: err }, 400);
//     else
//       res.send({ status: 'success', data: { fleetId: fle._id } });
//   });
// });

// // Handle sample upload request
// app.put('/samples', function (req, res) {

//   // Parse to JSON.
//   var uploadSamples;

//   var usr, veh, fname, vehicleId;
//   var sampleSet = {};
//   var firstError;
//   Step(
//     function parseSamples() {
//       var mimeType = requestMimeType(req);
//       if (mimeType == 'application/x-gzip') {
//         var fileName = (new Date()).valueOf() + '.pbraw.gz';
//         fs.mkdir(__dirname + '/samples', '0755', function (err) {
//           fs.writeFile(__dirname + '/samples/' + fileName,
//                       req.rawBody, null, function (err) {
//             if (err) log(err);
//             else
//               log('Saved to: ' + __dirname + '/samples/' + fileName);
//           });
//         });

//         var next = this;
//         Step(
//           function() {
//             zlib.unzip(new Buffer(req.rawBody, 'binary'), this);
//           }, function(err, unzipped) {
//             if (err) {
//               this(err);
//             } else {
//               uploadSamples = WebUploadSamples.parse(unzipped);
//               this();
//             }
//           }, next
//         );
//       } else if (mimeType == 'application/octet-stream') {
//         var fileName = (new Date()).valueOf() + '.pbraw';
//         fs.mkdir(__dirname + '/samples', '0755', function (err) {
//           fs.writeFile(__dirname + '/samples/' + fileName,
//                       req.rawBody, null, function (err) {
//             if (err) log(err);
//             else
//               log('Saved to: ' + __dirname + '/samples/' + fileName);
//           });
//         });

//         uploadSamples =
//             WebUploadSamples.parse(new Buffer(req.rawBody, 'binary'));
//         this();
//       } else if (mimeType == 'application/json') {
//         uploadSamples = req.body;
//         this();
//       } else {
//         throw ('BAD_ENCODING:' + mimeType);
//       }
//     },

//     //// TODO: Integrate some kind of authentication.
//     //// Public-key cryptography ?
//     // get the cycle's user and authenticate ** LAGACY **
//     // function getUser() {
//     //   User.findOne({ email: uploadSamples.userId }, this);
//     // }, function (err, usr_) {
//     //   usr = usr_;
//     //   if (!usr)
//     //     fail('USER_NOT_FOUND');
//     //   else if (!usr.authenticate(uploadSamples.password))
//     //     fail('INCORRECT_PASSWORD');
//     //   else
//     //     this();
//     // },
//     // get the cycle's vehicle
//     function getVehicle(err) {
//       if (err) return this(err);
//       vehicleId = uploadSamples.vehicleId;
//       userDb.collections.vehicles.findOne({ _id: vehicleId }, this);
//     }, function (err, veh_) {
//       if (err) return this(err);
//       veh = veh_;
//       if (!veh)
//         throw 'VEHICLE_NOT_FOUND';
//       else
//         this();
//     },
//     // save the cycle locally for now
//     function (err) {
//       if (err) return this(err);
//       var fileName = vehicleId + '_' + (new Date()).valueOf() + '.js';
//       fs.mkdir(__dirname + '/samples', '0755', function (err) {
//         /* Transform Buffers into arrays so they get stringified pretty. */
//         var newSamples = traverse(uploadSamples).map(function (o) {
//           if (_.isObject(o) && !_.isArray(o) && _.isNumber(o.length)) {
//             var a = Array(o.length);
//             for (var i = 0; i < o.length; ++i)
//               a[i] = o[i];
//             this.update(a);
//           }
//         });

//         fs.writeFile(__dirname + '/samples/' + fileName,
//                      JSON.stringify(newSamples, null, '  ') + '\n',
//                      function (err) {
//           if (err)
//             log(err);
//           else
//             log('Saved to: ' + __dirname + '/samples/' + fileName);
//         });
//       });
//       this();
//     },

//     // Store the data in the database.
//     function (err) {
//       if (err) return this(err);
//       // Process samples.
//       uploadSamples.sampleStream.forEach(function (sampleStream) {
//         var begin = 0, duration = 0;
//         sampleStream.sample.forEach(function (upSample) {
//           begin += upSample.beginDelta;  // Delta decode.
//           duration += upSample.durationDelta;  // Delta decode.
//           var val = upSample.valueFloat;
//           if (val == null) val = upSample.valueInt;
//           if (val == null) val = upSample.valueString;
//           if (val == null) val = upSample.valueBool;
//           if (val == null) val = _.toArray(upSample.valueBytes);  // raw->Buffer
//           if (val == null) {
//             firstError = firstError || ('SAMPLE_NO_VALUE');
//             return;
//           }
//           var sample = { beg: begin, end: begin + duration, val: val };
//           var schema = uploadSamples.schema[upSample.schemaIndex];
//           if (!schema) {
//             firstError = firstError || ('SAMPLE_NO_SCHEMA_FOUND');
//             return;
//           }
//           if (!sampleSet[schema.channelName])
//             sampleSet[schema.channelName] = [sample];
//           else
//             sampleSet[schema.channelName].push(sample);
//         });
//       });

//       if (!(uploadSamples.protocolVersion >= 2)) {
//         // HACK: Heuristically add durations to zero-duration samples.
//         sampleDb.addDurationHeuristicHack(vehicleId, sampleSet,
//                                           10 * SampleDb.s, this);
//       }
//     },

//     function (err) {
//       if (err) return this(err);

//       // Add schema samples.
//       var schemaSamples = [];
//       uploadSamples.schema.forEach(function (schema) {
//         var samples = sampleSet[schema.channelName];
//         // Ignore unused schemas.
//         if (!samples)
//           return;
//         var beg =
//             _.min(samples, function (sample) { return sample.beg; }).beg;
//         var end =
//             _.max(samples, function (sample) { return sample.end; }).end;
//         schema.type = schema.type.toLowerCase();
//         function transformEnumDescriptions(descriptions) {
//           var r = {};
//           descriptions.forEach(function (d) { r[d.value] = d.name });
//           return r;
//         }
//         if (schema.enumVals)
//           schema.enumVals = transformEnumDescriptions(schema.enumVals);
//         if (schema.bitfieldBits)
//           schema.bitfieldBits = transformEnumDescriptions(schema.bitfieldBits);
//         schemaSamples.push({ beg: beg, end: end, val: schema });
//       });
//       sampleSet._schema = schemaSamples;

//       // Check for errors.
//       if (firstError) {
//         throw firstError;
//         return;
//       }

//       // Insert in database.
//       sampleDb.insertSamples(vehicleId, sampleSet, this);
//     },

//     // Any exceptions above end up here.
//     function (err) {
//       if (err) {
//         log('Error while processing PUT /samples request: ' +
//             (err.stack || err));
//         res.send({ status: 'fail', data: { code: (err.stack || err) } }, 400);
//       } else {
//         // Success!
//         res.end();
//       }
//     }
//   );
// });

// // Maintain an approximate load average for this process.
// var loadAvg = 1.0;
// if (getrusage) {
//   var lastSampleTime, lastCpuTime;
//   setInterval(function () {
//     var now = Date.now();
//     var cpuTime = getrusage.getcputime();
//     if (lastSampleTime) {
//       var delta = Math.min(1, (now - lastSampleTime) * 1e-3);
//       var load = (cpuTime - lastCpuTime) / delta;
//       var rc = 0.2 * delta;
//       if (isNaN(loadAvg)) loadAvg = 1.0;  // Why does loadAvg occasionally become NaN?
//       loadAvg = (1 - rc) * loadAvg + rc * load;
//     }
//     lastSampleTime = now;
//     lastCpuTime = cpuTime;
//   }, 500);
// }

// // Get load average
// app.get('/status/load', function (req, res) {
//   res.end(loadAvg + '\n');
// });

// // Dump a message to a log file for debugging clients.
// app.post('/debug/:logFile', function (req, res) {
//   if (requestMimeType(req) != 'text/plain') {
//     res.statusCode = 400;
//     res.end('Use content-type: text/plain');
//     return;
//   }
//   var path = 'debug/' + req.params.logFile.replace(/\//g, '_');
//   try {
//     var stream = fs.createWriteStream(path, { flags: 'a', encoding: 'utf8' });
//     stream.on('error', function (err) {
//       log(req.url + ' - error writing: ' + err);
//       res.statusCode = 500;
//       res.end('Error writing: ' + err, 'utf8');
//     });
//     stream.on('close', function () { res.end() });
//     req.setEncoding('utf8');
//     var message = '';
//     req.on('data', function (m) { message += m });
//     req.on('end', function () {
//       if (!/\n$/.test(message))
//         message += '\n';
//       stream.end(message, 'utf8');
//     });
//   } catch (e) {
//     log(req.url + ' - error writing: ' + err);
//     res.statusCode = 500;
//     res.end('Error writing: ' + err, 'utf8');
//   }
// });


// ////////////// LEGACY

// function legacy(req, res) {
//   log('LEGACY ROUTE: ' + req.route.path);
//   res.send({ status: 'fail',
//           data: { code: 'ROUTE IS DEPRECATED' } }, 400);
// }

// // User create
// // ** Users are now created through Passport and UserDb.
// app.post('/usercreate/:newemail', legacy);

// // Vehicle create
// // ** Make, model and year are no longer relevant.
// // Replaced with /create/vehicle above.
// app.post('/vehiclecreate/:email/:make/:model/:year', legacy);

// // User info
// // ** Used by Henson but since telemetry devices
// // (tablets) are no longer associated with users and
// // we no longer find users by email, this is useless.
// // Not replaced.
// app.get('/userinfo/:email', legacy);

// // Vehicle info
// // ** Used by Henson but since telemetry devices
// // (tablets) are no longer associated with users,
// // this does not make sense.
// // Not replaced.
// app.get('/summary/:email/:vintid', legacy);

// // Dump cycles
// // ** Replaced by /samples above.
// app.put('/cycle', legacy);
