#!/usr/bin/env node

var util = require('util'), debug = util.debug, inspect = util.inspect;
var vm = require('vm');
var log = console.log;
var fs = require('fs');
var _ = require('underscore');

var SampleDb = require('../sample_db.js').SampleDb;

function readEntireStream(stream, cb) {
  var r = '';
  stream.setEncoding('utf8');
  stream.on('data', function(data) { r += data; });
  stream.on('end', function() { cb(r); });
  stream.resume();
}

readEntireStream(process.stdin, function(json) {
  var samples = vm.runInNewContext('(\n' + json + '\n)', {}, 'stdin');
  debug('Building channel tree...');
  var start = Date.now();
  var tree = SampleDb.buildChannelTree(samples);
  debug('Took ' + (Date.now() - start) + ' ms.');
  log(inspect(tree, false, null));
});
