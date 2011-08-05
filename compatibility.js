// Compatibility functions for converting from old schema to new schema.

var _ = require('underscore');
var mongodb = require('mongodb');
var util = require('util'), debug = util.debug;
var Step = require('step');

var SampleDb = require('./sample_db.js').SampleDb;

var standardSchema = exports.standardSchema = {
  'gps.speed_m_s': {
    channelName: 'gps.speed_m_s',
    humanName: 'GPS Speed',
    units: 'm/s',
    type: 'float',
  },
  'gps.latitude_deg': {
    channelName: 'gps.latitude_deg',
    humanName: 'GPS Latitude',
    units: '°',
    type: 'float',
  },
  'gps.longitude_deg': {
    channelName: 'gps.longitude_deg',
    humanName: 'GPS Longitude',
    units: '°',
    type: 'float',
  },
  'gps.altitude_m': {
    channelName: 'gps.altitude_m',
    humanName: 'GPS Altitude',
    units: 'm',
    type: 'float',
  },
  'accel.x_m_s2': {
    channelName: 'accel.x_m_s2',
    humanName: 'Acceleration X',
    units: 'm/s^2',
    type: 'float',
  },
  'accel.y_m_s2': {
    channelName: 'accel.y_m_s2',
    humanName: 'Acceleration Y',
    units: 'm/s^2',
    type: 'float',
  },
  'accel.z_m_s2': {
    channelName: 'accel.z_m_s2',
    humanName: 'Acceleration Z',
    units: 'm/s^2',
    type: 'float',
  },
  'compass.x_deg': {
    channelName: 'compass.x_deg',
    humanName: 'Heading X',
    units: '°',
    type: 'float',
  },
  'compass.y_deg': {
    channelName: 'compass.y_deg',
    humanName: 'Heading Y',
    units: '°',
    type: 'float',
  },
  'compass.z_deg': {
    channelName: 'compass.z_deg',
    humanName: 'Heading Z',
    units: '°',
    type: 'float',
  },
};

exports.insertEventsProto = function(sampleDb, eventsProto, options, cb) {
  try {
    options = options || {};
    var insertsPerTick = options.insertsPerTick || 100;

    var BP = mongodb.BinaryParser, rawId = eventsProto._id.id;
    var vehicleId = BP.decodeInt(rawId.substring(0,4), 32, true, true);
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
          beg: header.startTime * 1000,
          // end: header.stopTime * 1000,
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
      } else if (event.header.type == 'SENSOR_DATA' &&
                 event.header.source == 'SENSOR_COMPASS') {
        addSample('compass.x_deg', event.sensor[0]);
        addSample('compass.y_deg', event.sensor[1]);
        addSample('compass.z_deg', event.sensor[2]);
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
    _.each(_.values(sampleSets), function(samples) {
      SampleDb.sortSamplesByTime(samples);  // Sometimes Henson data is out of order. !!!
      var total = 0;
      samples.forEach(function(sample, index) {
        var nextSample = samples[index + 1];
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

    // Add _schema samples.
    var schemaSamples = [];
    var cycleStart = Number.MAX_VALUE, cycleEnd = Number.MIN_VALUE;
    Object.keys(sampleSets).forEach(function(channelName) {
      var samples = sampleSets[channelName];
      var beg = samples[0].beg, end = samples[samples.length - 1].end;
      cycleStart = Math.min(cycleStart, beg);
      cycleEnd = Math.max(cycleEnd, end);
      var schemaVal = standardSchema[channelName];
      if (!schemaVal) {
        log('No schema available for channel ' + channelName + '!');
        return;
      }
      schemaSamples.push({ beg: beg, end: end, val: schemaVal });
    });
    sampleSets['_schema'] = schemaSamples;

    // Add wake level sample.
    sampleSets['_wake'] = [{ beg: cycleStart, end: cycleEnd, val: 3 }];

    // Write samples to dest DB.
    sampleDb.insertSamples(vehicleId, sampleSets, cb);
  } catch (err) {
    cb(err);
  }
}
