// Compatibility functions for converting from old schema to new schema.

var _ = require('underscore');
var mongodb = require('mongodb');
var util = require('util'), debug = util.debug;
var Step = require('step');

var SampleDb = require('./sample_db.js').SampleDb;

exports.insertEventsProto = function(sampleDb, eventsProto, options, cb) {
  try {
    options = options || {};
    var insertsPerTick = options.insertsPerTick || 100;

    var BP = mongodb.BinaryParser, rawId = eventsProto._id.id;
    var vehicleId = BP.decodeInt(rawId.substring(4,8), 32, true, true) * 1000 +
        BP.decodeInt(rawId.substring(8,10), 16, true, true);
    debug('Processing a drive cycle ' + eventsProto._id + ' with ' +
          eventsProto.events.length + ' events + vehicle id ' +
          vehicleId + '...');

    // If not marked valid, ignore.
    if (!eventsProto.valid) {
      debug('Invalid drive cycle, ignoring...');
      cb(null);
      return;
    }

    // Sort into different sample types.
    var sampleSets = {};
    _.each(eventsProto.events, function(event) {
      function addSample(name, value) {
        if (_.isUndefined(value))
          return;
        var s = sampleSets[name];
        if (!s)
          s = sampleSets[name] = [];
        var header = event.header;
        // Arrgh, stopTime seems to be useless - sometimes it's before startTime.
        s.push({
          beg: header.startTime.toNumber() * 1000,
          // end: header.stopTime.toNumber() * 1000,
          val: value,
        });
      }

      if (event.header.type == 'LOCATION' &&
          event.header.source == 'SENSOR_GPS') {
        addSample('gps.speed_m_s', event.location.speed);
        addSample('gps.latitude_deg', event.location.latitude);
        addSample('gps.longitude_deg', event.location.longitude);
        addSample('gps.altitude_m', event.location.altitude);
        addSample('gps.accuracy_m', event.location.accuracy);
        addSample('gps.bearing_deg', event.location.bearing);
      } else if (event.header.type == 'SENSOR_DATA' &&
                 event.header.source == 'SENSOR_ACCEL') {
        addSample('accel.x_m_s2', event.sensor[0]);
        addSample('accel.y_m_s2', event.sensor[1]);
        addSample('accel.z_m_s2', event.sensor[2]);
      } else if (event.header.type == 'CAN_EVENT' &&
                 event.header.source == 'CAN_SOURCE') {
        var val;
        if (_.isNumber(event.can.payloadF))
          val = event.can.payloadF;
        else if (_.isNumber(event.can.payloadI))
          val = event.can.payloadI;
        if (!_.isUndefined(val))
          addSample('can.' + event.can.id, val);
      }
    });

    // Hack: Henson seems to always send stopTime == startTime, so synthesize
    // reasonable durations.
    _.each(_.values(sampleSets), function(s) {
      SampleDb.sortSamplesByTime(s);  // Sometimes Henson data is out of order. !!!
      var total = 0;
      s.forEach(function(sample, index) {
        var nextSample = s[index + 1];
        if (nextSample) {
          if (!sample.end)
            sample.end = nextSample.beg;
          total += sample.end - sample.beg;
        } else {
          // Store average duration in last sample, so it has something.
          if (!sample.end && index)
            sample.end = sample.beg + Math.ceil(total / index);
        }
      });
    });

    // Write data to dest DB, in chunks.
    var cycleStart = Number.MAX_VALUE, cycleEnd = Number.MIN_VALUE;
    var sampleCount = 0

    var insertsSoFar = 0;
    function processKeys(sampleKeys, cb) {
      if (sampleKeys.length) {
        var channelName = sampleKeys[0];
        processSamples(channelName, sampleSets[channelName], 0, function(err) {
          if (err)
            cb(err);
          else
            processKeys(sampleKeys.slice(1), cb);
        });
      } else {
        cb(null);
      }
    }

    function processSamples(channelName, samples, sampleIndex, cb) {
      if (sampleIndex < samples.length) {
        var sample = samples[sampleIndex];
        sampleDb.insertSample(vehicleId, channelName,
                              sample.beg, sample.end, sample.val);
        cycleStart = Math.min(cycleStart, sample.beg);
        cycleEnd = Math.max(cycleEnd, sample.end);
        ++sampleCount;
        function next() {
          processSamples(channelName, samples, sampleIndex + 1, cb);
        }
        if (++insertsSoFar >= insertsPerTick) {
          insertsSoFar = 0;
          process.nextTick(next);
        } else {
          next();
        }
      } else {
        cb(null);
      }
    }

    // Process all samples, then add drive cycle event to dest DB.
    processKeys(_.keys(sampleSets), function(err) {
      debug('Inserting drive cycle, times ' + cycleStart + '..' + cycleEnd +
            ', count ' + sampleCount + '.');
      sampleDb.insertSample(vehicleId, '_cycle', cycleStart, cycleEnd,
                            { sampleCount: sampleCount });
      cb(err);
    });
  } catch (err) {
    cb(err);
  }
}
