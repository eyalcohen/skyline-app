#!/usr/bin/env node

var log = require('console').log;
var logTimestamp = require('./log.js').logTimestamp;
var fs = require('fs');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var _ = require('underscore');
_.mixin(require('underscore.string'));
var color = require('cli-color');
var exec = require('child_process').exec;
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 8080)
    .describe('static', 'List of host:port to redirect static requests to')
      .default('static', '9000 9001')
      // .default('static', '9000')
    .describe('api', 'List of host:port to redirect API requests to')
      .default('api', '9010 9011 9012 9013 9014 9015')
      // .default('api', '9010')
    .argv;

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
var frontends = [].concat(parseFrontends(argv.static), parseFrontends(argv.api));

try { fs.mkdirSync('log'); } catch(err) {}

_.each(frontends, function (hp) {
  var logFile = 'log/frontend-' + hp.port + '.log';
  fs.writeFileSync(logFile, '644');
  exec('node app.js --port=' + hp.port + ' >> ' + logFile + ' 2>&1');
});

var logFile = 'log/scalar-' + argv.port + '.log';
fs.writeFileSync(logFile, '644');
exec('node scalar.js --port=' + argv.port + ' --static="'
    + argv.static + '" --api="' + argv.api + '" >> ' + logFile + ' 2>&1');

log('\n' + logTimestamp() + ' - ' + color.green('Skyline Scalar running on port ' + argv.port));
log(logTimestamp() + ' - ' + color.red('Static request ports: ' + argv.static));
log(logTimestamp() + ' - ' + color.blue('API request ports: ' + argv.api));


