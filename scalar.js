#!/usr/bin/env node

// This is a load balancer based on bouncy.
// It distributes requests to clients.
// It forwards static content requests to one set of frontends, and
// API requests to another set of frontends.
// For now, we simply distribute requests round-robin.  It would be better
// to implement some sort of load API to distribute to the least busy frontends.
// We need special support for socket.io requests to ensure that all requests
// in a given connection go to the same frontend.

var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 80)
    .describe('staticPorts', 'List of ports to redirect static requests to')
      .default('staticPorts', '8080,8081')
    .describe('apiPorts', 'List of ports to redirect API requests to')
      .default('apiPorts', '8082,8083')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

var bouncy = require('bouncy');
var fs = require('fs');
var log = require('console').log;
var util = require('util'), inspect = util.inspect;

var staticRE =
    RegExp(fs.readdirSync(__dirname + '/public').map(function(fname) {
      fname = fname.replace(/[\\^$*+?.()|{}\[\]]/, '\\$&');
      return '^/' + fname;
    }).join('|'));
var socketIORE = /^\/socket.io\//,
    socketIOExistingRE = /^\/socket.io\/[0-9]+\/[^/]+\/([0-9]+)$/;
var staticPorts = JSON.parse('['+argv.staticPorts+']');
var apiPorts = JSON.parse('['+argv.apiPorts+']');
var staticI = 0, apiI = 0;
var apiSessions = {};  // Mapping from sessionid to port.  TODO: expire sessions?

log('Waiting to bounce requests to ' + argv.port);
bouncy(function(req, bounce) {
  if (staticRE.test(req.url)) {
    var destPort = staticPorts[staticI];
    log('\x1b[1mstatic\x1b[0m \x1b[33m' + req.client.remoteAddress +
        ' ' + req.url + '\x1b[0m -> :' + destPort);
    if (++staticI >= staticPorts.length) staticI = 0;
    bounce(destPort, { headers: { Connection: 'close' } });
  } else if (socketIORE.test(req.url)) {
    var m = socketIOExistingRE(req.url);
    if (!m) {
      // This is a new unhandshaken socket.io connection.
      // Sniff the session id from the response.
      var destPort = apiPorts[apiI];
      log('\x1b[1msocket.io connect\x1b[0m \x1b[33m' +
          req.client.remoteAddress +
          ' ' + req.url + '\x1b[0m -> :' + destPort);
      if (++apiI >= apiPorts.length) apiI = 0;
      var stream = bounce(destPort, { headers: { Connection: 'close' } });

      stream.on('data', function(chunk) {
        // Format: '<headers>\n\n<#>\n<sid>:<#>:<#>:<transports>'
        var d = chunk.toString();
        var m = (/^([0-9]+):[0-9]+:[0-9]+:[^:]+$/m)(chunk.toString());
        if (m) {
          var sid = m[1];
          apiSessions[sid] = destPort;
          log('\x1b[1msocket.io connected\x1b[0m \x1b[33m' +
              req.client.remoteAddress +
              ' ' + sid + '\x1b[0m -> :' + destPort);
        }
      });
    } else {
      // This is an established socket.io connection.
      // Get the session id from the url, and bounce to the appropriate backend.
      var sid = m[1];
      var destPort = apiSessions[sid];
      if (destPort) {
        log('\x1b[1msocket.io\x1b[0m \x1b[33m' + req.client.remoteAddress +
            ' ' + req.url + '\x1b[0m -> :' + destPort);
        bounce(destPort);
      } else {
        log('\x1b[1msocket.io\x1b[0m \x1b[33m' + req.client.remoteAddress +
            ' ' + req.url + '\x1b[0m -> unknown!');
      }
    }
  } else {
    var destPort = apiPorts[apiI];
    log('\x1b[1mapi\x1b[0m \x1b[33m' + req.client.remoteAddress +
        ' ' + req.url + '\x1b[0m -> :' + destPort);
    if (++apiI >= apiPorts.length) apiI = 0;
    bounce(destPort);
  }
}).listen(argv.port);
