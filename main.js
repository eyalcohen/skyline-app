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
  var https = require('https');
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
  var Samples = require('./lib/samples').Samples;
  var Storage = require('./lib/storage');
  var resources = require('./lib/resources');
  var service = require('./lib/service');
  var Mailer = require('./lib/mailer');
  var PubSub = require('./lib/pubsub').PubSub;
  var Boiler = require('./lib/boiler');

  // Setup Environments
  var app = express();

  // Package info.
  app.set('package', JSON.parse(fs.readFileSync('package.json', 'utf8')));

  // App port is env var in production.
  app.set('PORT', process.env.PORT || argv.port);
  app.set('SECURE_PORT', 8443);

  // Add connection config to app.
  _.each(require('./config').get(process.env.NODE_ENV), function (v, k) {
    app.set(k, v);
  });

  // Middle-ware that supplies the raw body for certain MIME types.
  function rawBody(rawMimeTypes) {
    return function (req, res, next) {
      if ('GET' == req.method || 'HEAD' == req.method) return next();
      var mimeType = (req.headers['content-type'] || '').split(';')[0];
      if (_.contains(rawMimeTypes, mimeType)
          && (!req.body || _.isEmpty(req.body))) {
        // req.setEncoding(null);
        var buf = new Buffer('');
        req.on('data', function (chunk) {
          buf = Buffer.concat([buf, chunk]); });
        req.on('end', function () {
          req.rawBody = buf;
          next();
        });
      } else {
        next();
      }
    }
  }

  Step(
    function () {

      // Development only.
      if (process.env.NODE_ENV !== 'production') {

        // App params.
        app.set('ROOT_URI', '');
        app.set('HOME_URI', 'http://localhost:' + app.get('PORT'));

        // Job scheduling.
        app.set('SCHEDULE_JOBS', argv.jobs);
      }

      // Production only.
      else {

        // App params
        app.set('ROOT_URI', [app.get('package').builds.cloudfront,
            app.get('package').version].join('/'));
        app.set('HOME_URI', [app.get('package').protocol.name,
            app.get('package').domain].join('://'));

        // Job scheduling.
        app.set('SCHEDULE_JOBS', true);
      }

      // Redis connect.
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_CACHE')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));
    },
    function (err, rcCache, rc, rp, rs) {
      if (err) {
        console.error(err);
        process.exit(1);
        return;
      }

      // Common utils init.
      require('./lib/common').init(app.get('ROOT_URI'));

      // Mailer init.
      app.set('mailer', new Mailer(app.get('gmail'), app.get('HOME_URI')));

      // PubSub init.
      app.set('pubsub', new PubSub({mailer: app.get('mailer')}));

      // Express config.
      app.set('views', __dirname + '/views');
      app.set('view engine', 'jade');
      app.set('sessionStore', new RedisStore({client: rc, maxAge: 2592000000}));
      app.set('sessionSecret', 'time');
      app.set('sessionKey', 'express.sid');
      app.set('cookieParser', express.cookieParser(app.get('sessionKey')));
      app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
      app.use(express.logger('dev'));
      app.use(rawBody(['application/octet-stream', 'application/x-gzip']));
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

      // Development only.
      if (process.env.NODE_ENV !== 'production') {
        app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
        app.use(express.static(__dirname + '/public'));
        app.use(slashes(false));
        app.use(app.router);
        app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
      }

      // Production only.
      else {
        app.use(express.favicon(app.get('ROOT_URI') + '/img/favicon.ico'));
        app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
        app.use(slashes(false));
        app.use(app.router);
        app.use(function (err, req, res, next) {
          if (!err) return next();
          res.render('500', {root: app.get('ROOT_URI')});
        });
      }

      app.all('*', function (req, res, next) {

        // Check protocol.
        if (process.env.NODE_ENV === 'production'
            && app.get('package').protocol.name === 'https') {
          if (req.secure || _.find(app.get('package').protocol.allow,
              function (allow) {
            return req.url === allow.url && req.method === allow.method;
          })) {
            return _next();
          }
          res.redirect('https://' + req.headers.host + req.url);
        } else {
          _next();
        }

        // Ensure Safari does not cache the response.
        function _next() {
          var agent;
          agent = req.headers['user-agent'];
          if (agent.indexOf('Safari') > -1 && agent.indexOf('Chrome') === -1
              && agent.indexOf('OPR') === -1) {
            res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.header('Pragma', 'no-cache');
            res.header('Expires', 0);
          }
          next();
        }
      });

      if (!module.parent) {

        Step(
          function () {
            new Connection(app.get('MONGO_URI'), {ensureIndexes: argv.index}, this);
          },
          function (err, connection) {
            if (err) {
              return this(err);
            }

            // Attach a connection ref to app.
            app.set('connection', connection);

            // Attach a redis ref to app.
            app.set('redis', rcCache);

            // Init samples.
            new Samples(app, _.bind(function (err, samples) {
              if (err) return this(err);

              // Attach a samples ref to app.
              app.set('samples', samples);

              // Init resources.
              resources.init(app, this);
            }, this));
          },
          function (err) {
            if (err) {
              console.error(err);
              process.exit(1);
              return;
            }

            // Set up the storage class for static content.
            app.set('storage', new Storage());

            // Init service.
            service.routes(app);

            // Catch all.
            app.use(function (req, res) {
              var embed = req._parsedUrl.path.indexOf('/embed') === 0;
              res.render('index', {
                user: req.user,
                root: app.get('ROOT_URI'),
                embed: embed
              });
            });

            // HTTP(S) server.
            var server, _server;
            if (process.env.NODE_ENV !== 'production') {
              server = http.createServer(app);
            } else {
              server = https.createServer({
                ca: fs.readFileSync('./ssl/ca-chain.crt'),
                key: fs.readFileSync('./ssl/www_skyline-data_com.key'),
                cert: fs.readFileSync('./ssl/www_skyline-data_com.crt')
              }, app);
              _server = http.createServer(app);
            }

            // Socket handling
            var sio = socketio.listen(server,
                {secure: process.env.NODE_ENV === 'production'});
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
              socket.join('dataset');
              socket.join('view');
              socket.join('channel');
              socket.join('event');
              socket.join('note');
              socket.join('comment');
              socket.join('follow');
              socket.join('request');
              socket.join('accept');
              socket.join('watch');
              if (socket.handshake.user) {
                socket.join('usr-' + socket.handshake.user._id);
              }

              // FIXME: Use a key map instead of
              // attaching this directly to the socket.
              socket.client = new Client(socket, app.get('pubsub'),
                  app.get('samples'), rcCache, app.get('storage'));
            });

            // Set pubsub sio
            app.get('pubsub').setSocketIO(sio);

            // Start server
            if (process.env.NODE_ENV !== 'production') {
              server.listen(app.get('PORT'));
            } else {
              server.listen(app.get('SECURE_PORT'));
              _server.listen(app.get('PORT'));
            }
            util.log('Worker ' + cluster.worker.id
                + ': Web server listening on port '
                + (process.env.NODE_ENV !== 'production' ?
                app.get('PORT'): app.get('SECURE_PORT')));
          }
        );
      }
    }
  );
}
