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
      .describe('index', 'Ensure indexes on MongoDB collections')
        .boolean('index')
      .describe('jobs', 'Schedule jobs'
          + '(always `true` in production)')
        .boolean('jobs')
      .argv;

  if (argv._.length || argv.help) {
    optimist.showHelp();
    process.exit(1);
  }

  // Module Dependencies
  var http = require('http');
  var connect = require('connect');
  var express = require('express');
  var slashes = require('connect-slashes');
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
  var Connection = require('./lib/db').Connection;
  var Client = require('./lib/client').Client;
  var Samples = require('./lib/samples').Samples
  var resources = require('./lib/resources');
  var service = require('./lib/service');
  var Mailer = require('./lib/mailer');

  // Setup Environments
  var app = express();

  // Package info.
  app.set('package', JSON.parse(fs.readFileSync('package.json', 'utf8')));

  // App port is env var in production
  app.set('PORT', process.env.PORT || argv.port);

  // Add connection config to app.
  _.each(require('./config').get(process.env.NODE_ENV), function (v, k) {
    app.set(k, v);
  });

  Step(
    function () {

      // Development only
      if (process.env.NODE_ENV !== 'production') {

        // App params
        app.set('ROOT_URI', '');
        app.set('HOME_URI', 'http://localhost:' + app.get('PORT'));

        // Job scheduling.
        app.set('SCHEDULE_JOBS', argv.jobs);

        // Redis connect
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
        this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
      }

      // Production only
      else {

        // App params
        app.set('ROOT_URI', [app.get('package').cloudfront,
            app.get('package').version].join('/'));
        app.set('HOME_URI', [app.get('package').protocol,
            app.get('package').domain].join('://'));

        // Job scheduling.
        app.set('SCHEDULE_JOBS', true);

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

      // Mailer init
      app.set('mailer', new Mailer({
        user: app.get('package').gmail.user,
        password: app.get('package').gmail.password,
        host: 'smtp.gmail.com',
        ssl: true
      }, app.get('HOME_URI')));

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
      if (process.env.NODE_ENV !== 'production') {
        app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
        app.use(express.static(__dirname + '/public'));
        app.use(slashes(false));
        app.use(app.router);
        app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
      }

      // Production only
      else {
        app.use(express.favicon(app.get('ROOT_URI') + '/img/favicon.ico'));
        app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
        app.use(slashes(false));
        app.use(app.router);
        app.use(express.errorHandler());

        // Force HTTPS
        if (app.get('package').protocol === 'https')
          app.all('*', function (req, res, next) {
            if ((req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https')
              return next();
            res.redirect('https://' + req.headers.host + req.url);
          });
      }

      if (!module.parent) {

        Step(
          function () {
            new Connection(app.get('MONGO_URI'),
                {ensureIndexes: argv.index}, this);
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

            // Catch all.
            app.use(function (req, res) {
              res.render('index', {
                member: req.user,
                root: app.get('ROOT_URI')
              });
            });

            // HTTP server.
            var server = http.createServer(app);

            // Socket handling
            var sio = socketio.listen(server);
            sio.set('store', new socketio.RedisStore({
              redis: redis,
              redisPub: rp,
              redisSub: rs,
              redisClient: rc
            }));

            // Development only.
            if (process.env.NODE_ENV !== 'production') {
              sio.set('log level', 2);
            } else {
              sio.enable('browser client minification');
              sio.enable('browser client etag');
              sio.enable('browser client gzip');
              sio.set('log level', 1);
              sio.set('transports', [
                'websocket',
                'flashsocket',
                'htmlfile',
                'xhr-polling',
                'jsonp-polling'
              ]);
            }

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

              // FIXME: Use a key map instead of
              // attaching this directly to the socket.
              socket.client = new Client(socket, app.get('samples'));
            });

            // Attach a socket ref to app.
            app.set('sio', sio);

            // Start server
            server.listen(app.get('PORT'));
            util.log('Worker ' + cluster.worker.id
                + ': Web server listening on port ' + app.get('PORT'));
          }
        );
      }
    }
  );
}
