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
var mongodb = require('mongodb');
var socketio = require('socket.io');
var redis = require('redis');
var RedisStore = require('connect-redis')(express);
var jade = require('jade');
var passport = require('passport');
var util = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Connection = require('./lib/db.js').Connection;
var resources = require('./lib/resources');
var service = require('./lib/service');
var Client = require('./lib/client.js').Client;

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

    if (!module.parent) {

      Step(
        function () {
          var ei = 'production' === app.get('env') || argv.index;
          new Connection(app.get('MONGO_URI'), {ensureIndexes: ei}, this);
        },
        function (err, connection) {
          if (err) {
            util.error(err);
            process.exit(1);
            return;
          }

          // Attach a connection ref to app.
          app.set('connection', connection);

          // Init resources.
          resources.init(app, this);
        },
        function (err) {
          if (err) return console.error(err);

          // Init service.
          service.routes(app);

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
            socket.client = new Client(socket);

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

            util.log('Web server listening on port ' + app.get('PORT'));
          });
        }
      );

    }
  }

);
