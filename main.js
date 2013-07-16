#!/usr/bin/env node
/*
 * main.js: Entry point for the Skyline app.
 *
 */

var cluster = require('cluster');
var util = require('util');

if (cluster.isMaster) {

  // Count the machine's CPUs
  var cpus = require('os').cpus().length;

  // Create a worker for each CPU
  for (var i = 0; i < cpus; ++i)
    cluster.fork();

  // Listen for dying workers
  cluster.on('exit', function (worker) {

    // Replace the dead worker.
    util.log('Worker ' + worker.id + ' died');
    cluster.fork();
  });

} else {

  // Arguments
  var optimist = require('optimist');
  var argv = optimist
      .describe('help', 'Get help')
      .describe('port', 'Port to listen on')
        .default('port', 8080)
      .describe('dburi', 'MongoDB URI to connect to')
        .default('dburi', 'mongodb://localhost:27017/skyline')
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
  var psio = require('passport.socketio');
  var fs = require('fs');
  var path = require('path');
  var url = require('url');
  var Step = require('step');
  var color = require('cli-color');
  var _ = require('underscore');
  _.mixin(require('underscore.string'));
  var Connection = require('./lib/db.js').Connection;
  var Client = require('./lib/client.js').Client;
  var Samples = require('./lib/samples.js').Samples
  var resources = require('./lib/resources');
  var service = require('./lib/service');

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
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
      }

      // Production only
      if ('production' === app.get('env')) {

        // App params
        app.set('MONGO_URI', 'mongodb://rider:hummmcycles@zoe.mongohq.com:10014/skyline');
        app.set('REDIS_HOST', 'crestfish.redistogo.com');
        app.set('REDIS_PORT', 9084);
        app.set('REDIS_PASS', '1b8a95ad4e582be0a56783b95392ce98');

        // Redis connect
        var clients = [
          redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST')),
          redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST')),
          redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST'))
        ];
        var next = _.after(clients.length, this);
        _.each(clients, function (c) {
          c.auth(app.get('REDIS_PASS'), function (err) {
            next(err, clients[0], clients[1], clients[2]);
          });
        });
      }

    },
    function (err, rc, rp, rs) {
      if (err) return util.error(err);

      app.set('views', __dirname + '/views');
      app.set('view engine', 'jade');
      app.set('sessionStore', new RedisStore({client: rc, maxAge: 2592000000}));
      app.set('sessionSecret', 'hummmcycles');
      app.set('sessionKey', 'express.sid');
      app.set('cookieParser', express.cookieParser(app.get('sessionKey')));
      app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
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
            resources.init(app, this.parallel());

            // Create samples.
            app.set('samples', new Samples(app, this.parallel()));

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
            sio.set('store', new socketio.RedisStore({
              redis: redis,
              redisPub: rp,
              redisSub: rs,
              redisClient: rc
            }));

            // Start server
            server.listen(app.get('PORT'));

            // Socket auth
            sio.set('authorization', psio.authorize({
              cookieParser: express.cookieParser,
              key: app.get('sessionKey'),
              secret: app.get('sessionSecret'),
              store: app.get('sessionStore'),
              fail: function(data, accept) { accept(null, true); },
              success: function(data, accept) { accept(null, true); }
            }));

            // Socket connect
            sio.sockets.on('connection', function (socket) {
              util.log('Worker ' + cluster.worker.id + ': Socket connected');

              // FIXME: Use a key map instead of attaching this
              // direct to the socket.
              socket.client = new Client(socket, app.get('samples'));

              socket.on('disconnect', function () {
                util.log('Worker ' + cluster.worker.id + ': Socket disconnected');
              });

              util.log('Worker ' + cluster.worker.id
                  + ': Web server listening on port ' + app.get('PORT'));
            });
          }
        );

      }
    }

  );

}
