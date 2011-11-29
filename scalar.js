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

// TODO:
//   * Don't die when we can't talk to targets.
//   * Health-check targets, and distribute based on target health/load.

var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 8080)
    .describe('static', 'List of host:port to redirect static requests to')
      .default('static', '9000')
    .describe('api', 'List of host:port to redirect API requests to')
      .default('api', '9010 9011')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

var bouncy = require('bouncy');
var fs = require('fs');
var http = require('http');
var color = require('cli-color');
var log = require('console').log;
var util = require('util'), inspect = util.inspect;

var staticRE =
    RegExp(fs.readdirSync(__dirname + '/public').map(function(fname) {
      fname = fname.replace(/[\\^$*+?.()|{}\[\]]/, '\\$&');
      return '^/' + fname;
    }).join('|'));
var socketIORE = /^\/socket.io\//,
    socketIOExistingRE = /^\/socket.io\/[0-9]+\/[^/]+\/([0-9]+)(?:\?.*)?$/;

function parseFrontends(arg) {
  return String(arg).split(' ').map(function(hp) {
    var m = /^(.+):([0-9]+)$/(hp);
    return m ? { host: m[0], port: Number(m[1]) } : { port: Number(hp) };
  });
}
var staticFrontends = parseFrontends(argv.static);
var apiFrontends = parseFrontends(argv.api);
var staticI = 0;

var apiSessions = {};  // Mapping from sessionid to port.  TODO: expire sessions?

log('Waiting to bounce requests to ' + argv.port);
bouncy(function(req, bounce) {
  function safeBounce(frontend, opts) {
    if (!frontend) {
      // None of the frontends are healthy, return a 503 Service Unavailable.
      var res = bounce.respond();
      res.writeHead(503, 'All frontends down');
      res.end();
      return;
    }
    var stream = bounce(frontend.host, frontend.port, opts);
    stream.on('error', function(e) {
      log(color.red('error ') + 'connecting to ' +
              color.yellow((frontend.host || '') + ':' + frontend.port) +
              ': ' + e);
      frontend.loadAvg = null;
      var res = bounce.respond();
      var url = 'http://' + req.headers.host + req.url;
      res.writeHead(302, 'Scalar could not connect to frontend',
                    { Location: url });
      res.end();
    });
    return stream;
  }

  if (staticRE.test(req.url)) {
    // Find a healthy destination to talk to.
    var frontend = null;
    for (var i = 0, len = staticFrontends.length; i < len; ++i) {
      frontend = staticFrontends[staticI];
      if (++staticI >= len) staticI = 0;
      if (frontend.loadAvg != null) break;
    }
    logRedirect('static', req, frontend);
    safeBounce(frontend, { headers: { Connection: 'close' } });
  } else if (socketIORE.test(req.url)) {
    var m = socketIOExistingRE(req.url);
    if (!m) {
      // This is a new unhandshaken socket.io connection.
      // Sniff the session id from the response.
      var frontend = bestApiFrontend();
      logRedirect('socket.io connect', req, frontend);
      var stream = safeBounce(frontend, { headers: { Connection: 'close' } });
      if (!stream) return;

      stream.on('data', function(chunk) {
        // Format: '<headers>\n\n<#>\n<sid>:<#>:<#>:<transports>'
        var d = chunk.toString();
        var m = (/^([0-9]+):[0-9]+:[0-9]+:[^:]+$/m)(chunk.toString());
        if (m) {
          var sid = m[1];
          apiSessions[sid] = frontend;
          log(color.red('socket.io connected') + ' ' +
              color.yellow(req.client.remoteAddress + ' ' + sid) + ' ' +
              (frontend.host || '') + ':' + frontend.port);
        }
      });
    } else {
      // This is an established socket.io connection.
      // Get the session id from the url, and bounce to the appropriate backend.
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
}).listen(argv.port);

function bestApiFrontend() {
  var bestLoad = Infinity, bestFrontend = null;
  apiFrontends.forEach(function(frontend, i) {
    var load = frontend.loadAvg + (frontend.penalty || 0);
    if (load < bestLoad) {
      bestLoad = load; bestFrontend = frontend;
    }
  });
  // Add a small penalty for each redirect to an API frontend, to distribute
  // the load.
  if (bestFrontend)
    bestFrontend.penalty = (bestFrontend.penalty || 0) + 0.05;
  return bestFrontend;
}

function logRedirect(method, req, frontend) {
  var dest = 'unknown!';
  if (frontend) dest = (frontend.host || '') + ':' + frontend.port;
  log(color.red(method) + ' ' +
      color.yellow(req.client.remoteAddress + ' ' + req.url) + ' ' +
      dest);
}

// Periodically poll all frontends for load average.
setInterval(function() {
  staticFrontends.forEach(pollFrontend);
  apiFrontends.forEach(pollFrontend);
}, 1000);
function pollFrontend(frontend) {
  var req = http.get({ host: frontend.host, port: frontend.port,
                       path: '/status/load' }, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      var n = Number(chunk);
      if (isNaN(n)) {
        log('Polling ' + frontend.host + ':' + frontend.port +
            ': could not parse loadAvg ' + JSON.stringify(chunk));
        frontend.loadAvg = null;
      } else {
        //log('Polling ' + frontend.host + ':' + frontend.port + ': got loadAvg ' + n);
        frontend.loadAvg = n;
      }
      clearTimeout(timeout);
    });
  });
  req.on('error', function(e) {
    frontend.loadAvg = null;
    log('Error polling ' + frontend.host + ':' + frontend.port +
        ': ' + e.message);
    clearTimeout(timeout);
  });
  var timeout = setTimeout(function() {
    req.abort();
    frontend.loadAvg = null;
    log('Timeout polling ' + frontend.host + ':' + frontend.port);
  }, 750);
}
