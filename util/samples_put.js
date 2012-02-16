#!/usr/bin/env node

var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var exec = require('child_process').exec;
var optimist = require('optimist');
var argv = optimist
    .alias('h', 'host')
    .alias('f', 'file')
    .default('host', 'localhost:8080')
    .demand('file')
    .argv;

function puts(error, stdout, stderr) { util.puts(stdout); }

exec('curl http://' + argv.host + '/samples -i -H "Content-Type:application/octet-stream" -X PUT --data-binary @' + argv.file, puts);

