#!/usr/bin/env node

// Convert JSON to WebUploadSamples proto buf.

var util = require('util'), debug = util.debug, inspect = util.inspect;
var log = console.log;
var fs = require('fs');
var _ = require('underscore');
var traverse = require('traverse');
var ProtobufSchema = require('protobuf_for_node').Schema;
var Event = new ProtobufSchema(fs.readFileSync(
    __dirname + '/../../mission-java/common/src/main/protobuf/Events.desc'));
var WebUploadSamples = Event['event.WebUploadSamples'];

function readEntireStream(stream, cb) {
  var r = '';
  stream.setEncoding('utf8');
  stream.on('data', function(data) { r += data; });
  stream.on('end', function() { cb(r); });
  stream.resume();
}

readEntireStream(process.stdin, function(json) {
  var jsobj = JSON.parse(json);

  /* Transform Buffers which got dumped as objects back into Buffers. */
  /*
  traverse(jsobj).forEach(function(o) {
    if (_.isObject(o) && !_.isArray(o) && _.isNumber(o.length)) {
      var a = Buffer(o.length);
      for (var i = 0; i < o.length; ++i)
        a[i] = o[i];
      this.update(a);
    }
  });
  */
  jsobj.sampleStream.forEach(function(stream) {
    stream.sample.forEach(function(sample) {
      var o = sample.valueBytes;
      if (_.isObject(o) && _.isNumber(o.length)) {
        var a = sample.valueBytes = Buffer(o.length);
        for (var i = 0; i < o.length; ++i)
          a[i] = o[i];
      }
    });
  });

  var uploadSamples = WebUploadSamples.serialize(jsobj);

  process.stdout.write(uploadSamples);

  process.stdout.once('close', function() { process.exit(0) });
  process.stdout.destroySoon();
});
