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
    app.set('sessionSecret', 'hummmcycles');
    app.set('sessionKey', 'express.sid');
    app.set('cookieParser', express.cookieParser(app.get('sessionKey')));
    app.use(express.favicon(__dirname + '/public/gfx/favicon.ico'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(app.get('cookieParser'));
    app.use(express.session({
      store: app.get('sessionStore'),
      secret: app.get('sessionSecret'),
      key: app.get('sessionKey')
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
          var sio = socketio.listen(server);
          sio.set('log level', 1);

          // Start server
          server.listen(app.get('PORT'));

          // Socket auth
          sio.set('authorization', function (data, cb) {
            if (data.headers.cookie) {
              app.get('cookieParser')(data, {}, function (err) {
                if (err) return cb(err, false);
                var cookie = data.cookies[app.get('sessionKey')];

                // FIXME: Do this the unsign way.
                var sid = cookie.split('.')[0].split(':')[1];

                // Save the session store to the data object 
                // (as required by the Session constructor).
                data.sessionStore = app.get('sessionStore');
                data.sessionStore.get(sid, function (err, session) {
                  if (err || !session) return cb('Error', false);

                  // Create a session object, passing data as request and our
                  // just acquired session data.
                  data.session =
                      new connect.middleware.session.Session(data, session);
                  cb(null, true);
                });

              });
            } else return cb('No cookie transmitted.', false);
          });

          // Socket connect
          sio.sockets.on('connection', function (socket) {
            util.log('Socket connected');

            // FIXME: Use a key map instead of attaching this
            // direct to the socket.
            socket.client = new Client(socket, userDb, sampleDb);

            // Setup an inteval that will keep our session fresh.
            var intervalID = setInterval(function () {

              // Reload the session (just in case something changed,
              // we don't want to override anything, but the age)
              // reloading will also ensure we keep an up2date copy
              // of the session with our connection.
              socket.handshake.session.reload(function () {

                // "touch" it (resetting maxAge and lastAccess)
                // and save it back again.
                socket.handshake.session.touch().save();
              });
            }, 60 * 1000);

            socket.on('disconnect', function () {
              util.log('Socket disconnected');

              // clear the socket interval to stop refreshing the session.
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

  // Profile
  app.get('/:username', function (req, res) {
    res.render('index');
  });

  // Graph
  app.get('/:username/:did', function (req, res) {
    res.render('index');
  });

}
