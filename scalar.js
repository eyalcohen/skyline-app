#!/usr/bin/env node

// This is a load balancer based on bouncy.
// It distributes requests to clients.
// It forwards static content requests to one set of frontends, and
// API requests to another set of frontends.
// For now, we simply distribute requests round-robin.  It would be better
// to implement some sort of load API to distribute to the least busy frontends.
// We need special support for socket.io requests to ensure that all requests
// in a given connection go to the same frontend.

// TODO: perhaps we'd get better performance with:
//   https://github.com/nodejitsu/node-http-proxy

var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen for http connnections on')
      .default('port', 8080)
    .describe('httpsPort', 'Port to listen for https connections on')
      .default('httpsPort', 8443)
    .describe('redirectNoPort', 'Don\'t include port for http->https redirects')
      .boolean('redirectNoPort')
    .describe('static', 'List of host:port to redirect static requests to')
      .default('static', '9000 9001')
    .describe('api', 'List of host:port to redirect API requests to')
      .default('api', '9010 9011')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

var _ = require('underscore');
var bouncy = require('bouncy');
var color = require('cli-color');
var fs = require('fs');
var http = require('http');
var https = require('https');
var log = require('./log.js').log;
var url = require('url');
var util = require('util'), inspect = util.inspect;

var staticRE =
    RegExp(fs.readdirSync(__dirname + '/public').map(function(fname) {
      fname = fname.replace(/[\\^$*+?.()|{}\[\]]/, '\\$&');
      return '^/' + fname;
    }).join('|'));
var authRE = /^\/auth\//;
var socketIORE = /^\/socket.io\//,
    socketIOExistingRE = /^\/socket.io\/[0-9]+\/[^/]+\/([0-9]+)(?:\?.*)?$/;
var redirectRE = /^\/(?:\?.*)?$/;  // Redirect http -> https.

function parseFrontends(arg) {
  return String(arg).split(' ').map(function(hp) {
    var m = hp.match(/^(.+):([0-9]+)$/);
    return {
      host: m && m[0],
      port: m ? m[1] : Number(hp),
      penalty: 0,
    };
  });
}
var staticFrontends = parseFrontends(argv.static);
var apiFrontends = parseFrontends(argv.api);
var staticI = 0;

var apiSessions = {};  // Mapping from sessionid to port.  TODO: expire sessions?

function makeBouncyServer(port, tls) {
  var coloredProtocol = (tls ? color.blue('https') : color.magenta('http'));
  log(coloredProtocol + ': ' + 'Waiting to bounce requests to ' + port);
  var bouncyServer = bouncy({
    callback: handleRequest,
    onConnectionError: function(e, connection) {
      log(coloredProtocol + ' ' + color.red('CONNECTION ERROR') + ' from ' +
          connection.remoteAddress + ':' + connection.remotePort + ': ' +
          (e.stack || e));
    },
    key: tls && fs.readFileSync(__dirname + '/keys/privatekey.pem'),
    cert: tls && fs.readFileSync(__dirname + '/keys/certificate.pem'),
    ca: tls && [ fs.readFileSync(__dirname + '/keys/intermediate.pem') ],
  });
  bouncyServer.listen(port);
  bouncyServer.on('error', function(e) {
    log(coloredProtocol + ' ' + color.red('SERVER ERROR') + ': ' +
        (e.stack || e));
  });

  function handleRequest(req, bounce) {
    function safeBounce(frontend, opts) {
      if (!frontend) {
        // None of the frontends are healthy, return a 503 Service Unavailable.
        var res = bounce.respond();
        res.writeHead(503, 'All frontends down');
        res.end();
        return;
      }
      try {
        var opts = { emitter: { emit: onerror } };
        var stream = frontend.host ?
            bounce(frontend.host, frontend.port, opts) :
            bounce(frontend.port, opts);
        stream.on('error', onerror);
      } catch (e) {
        onerror(e);
      }
      function onerror(e) {
        log(coloredProtocol + ' ' + color.red('error ') + 'connecting to ' +
            color.yellow((frontend.host || '') + ':' + frontend.port) +
            ': ' + (e.stack || e));
        setLoadAvg(frontend, null, e);
        var res = bounce.respond();
        var url = (tls ? 'https://' : 'http://') + req.headers.host + req.url;
        res.writeHead(302, 'Scalar could not connect to frontend',
                      { Location: url });
        res.end();
      }
      return stream;
    }

    // https://github.com/yorickvP/bouncy/commit/26412d586cbb5023e6256c2384828bde11886f1a
    req.on('error', function(e) {
      var conn = req.connection || {};
      log(coloredProtocol + ' ' + color.red('request error ') + 'from host ' +
          color.yellow(conn.remoteAddress || 'unknown') +
          ': ' + (e.stack || e));
      req.destroy();
    });

    if (!tls && argv.httpsPort && redirectRE.test(req.url)) {
      var res = bounce.respond();
      var host = req.headers.host.match(/^(.*?)(:[0-9]+)?$/)[1];
      var newUrl = url.format({
        protocol: 'https:',
        hostname: host,
        port: argv.redirectNoPort ? null : argv.httpsPort,
        pathname: req.url,
      });
      logRedirect('https redirect', req, newUrl);
      res.writeHead(301, 'Please use https', { Location: newUrl });
      res.end();
    } else if (staticRE.test(req.url)) {
      // Find a healthy destination to talk to.
      var frontend = null;
      for (var i = 0, len = staticFrontends.length; i < len; ++i) {
        frontend = staticFrontends[staticI];
        if (++staticI >= len) staticI = 0;
        if (frontend.loadAvg != null) break;
      }
      logRedirect('static', req, frontend);
      safeBounce(frontend, { headers: { Connection: 'close' } });
    } else if (authRE.test(req.url)) {
      // HACK: direct all auth requests to the first healthy static frontend.
      // This way the /auth/google request and the /auth/google/return requests
      // hit the same server.
      // Find the first healthy destination to talk to.
      var frontend = null;
      for (var i = 0, len = staticFrontends.length; i < len; ++i) {
        frontend = staticFrontends[i];
        if (frontend.loadAvg != null) break;
      }
      logRedirect('auth', req, frontend);
      safeBounce(frontend, { headers: { Connection: 'close' } });
    } else if (socketIORE.test(req.url)) {
      var m = req.url.match(socketIOExistingRE);
      if (!m) {
        // This is a new unhandshaken socket.io connection.
        // Sniff the session id from the response.
        var frontend = bestApiFrontend();
        logRedirect('socket.io connect', req, frontend);
        var stream = safeBounce(frontend, { headers: { Connection: 'close' } });
        if (!stream) return;

        stream.on('data', function(chunk) {
          // Format: '<headers>\n\n<#>\n<sid>:<#>:<#>:<transports>'
          var m = chunk.toString().match(/^([0-9]+):[0-9]+:[0-9]+:[^:]+$/m);
          if (m) {
            var sid = m[1];
            apiSessions[sid] = frontend;
            log(coloredProtocol + ' ' + color.red('socket.io connected') + ' ' +
                color.yellow(req.client.remoteAddress + ' ' + sid) + ' ' +
                (frontend.host || '') + ':' + frontend.port);
          }
        });
      } else {
        // This is an established socket.io connection.
        // Get session id from the url, and bounce to the appropriate backend.
        var sid = m[1];
        var frontend = apiSessions[sid];
        logRedirect('socket.io', req, frontend);
        safeBounce(frontend);
      }
    } else {
      var frontend = bestApiFrontend();
      logRedirect('api', req, frontend);
      safeBounce(frontend);
    }
  }

  function logRedirect(method, req, frontend) {
    var dest =
        _.isObject(frontend) ? (frontend.host || '') + ':' + frontend.port :
        frontend ? frontend :
        'unknown!';
    log(coloredProtocol + ' ' +
        color.red(method) + ' ' +
        color.yellow(req.client.remoteAddress + ' ' + req.url) + ' ' +
        dest);
  }
}

if (argv.port)
  makeBouncyServer(argv.port, false);
if (argv.httpsPort)
  makeBouncyServer(argv.httpsPort, true);

function bestApiFrontend() {
  var bestLoad = Infinity, bestFrontend = null;
  apiFrontends.forEach(function(frontend, i) {
    var load = frontend.loadAvg + frontend.penalty;
    if (frontend.loadAvg != null && load < bestLoad) {
      bestLoad = load; bestFrontend = frontend;
    }
  });
  // Add a small penalty for each redirect to an API frontend, to distribute
  // the load.
  if (bestFrontend)
    bestFrontend.penalty += 0.05;
  return bestFrontend;
}

function setLoadAvg(frontend, loadAvg, message) {
  var msg;
  if (!('loadAvg' in frontend) || (frontend.loadAvg == null) != (loadAvg == null)) {
    log((loadAvg == null ? color.red : color.green)(
        'Frontend ' + (frontend.host || '') + ':' + frontend.port + ' became ' +
        (loadAvg == null ? 'unhealthy: ' : 'healthy: ') + message));
    // When a frontend becomes healthy, assign it the lowest penalty of any API frontend.
    // This prevents a long-dead frontend from having a very low penalty
    // compared to all the others and getting all API traffic.
    var penalty = Infinity;
    apiFrontends.forEach(function(f) {
      if (f.loadAvg != null && f.penalty < penalty)
        penalty = f.penalty;
    });
    frontend.penalty = isFinite(penalty) ? penalty : 0;
  }
  frontend.loadAvg = loadAvg;
}

// Periodically poll all frontends for load average.
setInterval(function() {
  staticFrontends.forEach(pollFrontend);
  apiFrontends.forEach(pollFrontend);
}, 1000);
function pollFrontend(frontend) {
  var req = http.get({ host: frontend.host, port: frontend.port,
                    path: '/status/load', headers: {'cookie': frontend.cookies } },
                    function(res) {
    frontend.cookies = cleanCookies(res.headers['set-cookie']);
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      var n = Number(chunk);
      if (isNaN(n)) {
        setLoadAvg(frontend, null, 'could not parse loadAvg ' + JSON.stringify(chunk));
      } else {
        setLoadAvg(frontend, n, 'got loadAvg ' + n);
      }
      clearTimeout(timeout);
    });
  });
  req.on('error', function(e) {
    setLoadAvg(frontend, null, e.message);
    clearTimeout(timeout);
  });
  var timeout = setTimeout(function() {
    req.abort();
    setLoadAvg(frontend, null, 'timeout');
  }, 750);
}

function cleanCookies(cookies) {
  var clean = [];
  cookies.forEach(function (c) {
    var cookie = '';
    var parts = c.split('; ');
    parts.forEach(function (p) {
      if (p.indexOf('path') === -1
          && p.indexOf('expires') === -1
          && p.indexOf('=') !== -1)
        cookie += p;
    });
    clean.push(cookie);
  });
  return clean;
}
