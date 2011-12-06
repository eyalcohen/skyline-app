#!/usr/bin/env node

// Convert WebUploadSamples proto buf to JSON.

var util = require('util'), debug = util.debug, inspect = util.inspect;
var log = console.log;
var fs = require('fs');
var _ = require('underscore');
var Buffers = require('buffers');
var traverse = require('traverse');
var ProtobufSchema = require('protobuf_for_node').Schema;
var Event = new ProtobufSchema(fs.readFileSync(
    __dirname + '/../../mission-java/common/src/main/protobuf/Events.desc'));
var WebUploadSamples = Event['event.WebUploadSamples'];

function readEntireStreamRaw(stream, cb) {
  var bufs = Buffers();
  stream.on('data', function(data) { bufs.push(data) });
  stream.on('end', function() { cb(bufs.toBuffer()) });
  stream.resume();
}

readEntireStreamRaw(process.stdin, function(uploadSamples) {
  fs.writeFileSync('raw.pbraw', uploadSamples);
  var jsobj = WebUploadSamples.parse(uploadSamples);

  /* Transform Buffers into arrays so they get stringified pretty. */
  var newObj = traverse(jsobj).map(function(o) {
    if (_.isObject(o) && !_.isArray(o) && _.isNumber(o.length)) {
      var a = Array(o.length);
      for (var i = 0; i < o.length; ++i)
        a[i] = o[i];
      this.update(a);
    }
  });

  process.stdout.write(JSON.stringify(newObj, null, '  '), 'utf8');

  process.stdout.once('close', function() { process.exit(0) });
  process.stdout.destroySoon();
});
