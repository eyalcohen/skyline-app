// Compatibility functions for converting from old schema to new schema.

var _ = require('underscore');
var mongodb = require('mongodb');
var util = require('util'), debug = util.debug;
var Step = require('step');

var SampleDb = require('./sample_db.js').SampleDb;

var standardSchema = exports.standardSchema = {
  '_wake': {
    channelName: '_wake',
    humanName: 'Vehicle Drive Level',
    units: '3: driving',
    type: 'int',
    merge: true,
  },
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
  'cellPos.latitude_deg': {
    channelName: 'cellPos.latitude_deg',
    humanName: 'Cell Tower Latitude',
    units: '°',
    type: 'float',
  },
  'cellPos.longitude_deg': {
    channelName: 'cellPos.longitude_deg',
    humanName: 'Cell Tower Longitude',
    units: '°',
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

exports.insertEventBucket = function(sampleDb, eventBucket, cb) {
  try {
    //console.time('makeSamples');
    var BP = mongodb.BinaryParser, rawId = eventBucket._id.id;
    var vehicleId = BP.decodeInt(rawId.substring(0,4), 32, true, true);
    debug('Processing a drive cycle ' + eventBucket._id + ' with ' +
          eventBucket.events.length + ' events + vehicle id ' +
          vehicleId + '...');

    // Sort into different sample types.
    var sampleSets = {};
    var gotWake = false;
    if (eventBucket.bounds != null &&
        eventBucket.bounds.start != null && eventBucket.bounds.stop != null) {
      sampleSets['_wake'] = [{
        beg: eventBucket.bounds.start * 1000,
        end: eventBucket.bounds.stop * 1000,
        val: 3
      }];
      gotWake = true;
    }
    _.each(eventBucket.events, function(event) {
      function addSample(name, value) {
        if (_.isUndefined(value))
          return;
        var s = sampleSets[name];
        if (!s)
          s = sampleSets[name] = [];
        var header = event.header;
        s.push({
          beg: header.startTime * 1000,
          end: header.stopTime * 1000,
          val: value,
        });
      }
      function addLocationSample(prefix) {
        addSample(prefix + '.speed_m_s', event.location.speed);
        addSample(prefix + '.latitude_deg', event.location.latitude);
        addSample(prefix + '.longitude_deg', event.location.longitude);
        addSample(prefix + '.altitude_m', event.location.altitude);
        addSample(prefix + '.accuracy_m', event.location.accuracy);
        addSample(prefix + '.bearing_deg', event.location.bearing);
      }

      if (event.header.type == 'LOCATION') {
        if (event.header.source == 'SENSOR_GPS')
          addLocationSample('gps');
        if (event.header.source == 'SENSOR_CELLPOS')
          addLocationSample('cellPos');
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
          addSample('can.' + event.can.id.toString(16), val);
      } else if (event.header.type == 'DRIVE_SESSION' && !gotWake) {
        addSample('_wake', 3);
      }
    });
    //console.timeEnd('makeSamples');

    //console.time('durations');
    // HACK: Drive Cycle app seems to always send stopTime == startTime or
    // other bogus stopTimes, so synthesize reasonable durations.
    var latestEnd = Number.MIN_VALUE;
    _.each(_.keys(sampleSets), function(channelName) {
      var samples = sampleSets[channelName];
      // Sometimes Henson data is out of order. !!!
      SampleDb.sortSamplesByTime(samples);
      if (channelName == '_wake')
        return;
      var total = 0;
      samples.forEach(function(sample, index) {
        var nextSample = samples[index + 1];
        if (nextSample) {
          sample.end = nextSample.beg;
          total += sample.end - sample.beg;
        } else {
          // Store average duration in last sample, so it has something.
          if (index)
            sample.end = sample.beg + Math.ceil(total / index);
          else
            sample.end = sample.beg + 1000;
        }
        latestEnd = Math.max(latestEnd, sample.end);
      });
    });

    // HACK: some DRIVE_SESSION events are lacking a stopTime.
    // If so, synthesize a stopTime.
    (sampleSets['_wake'] || []).forEach(function(sample) {
      if (sample.end == null || _.isNaN(sample.end)) {
        sample.end = latestEnd;
        console.log('DRIVE_SESSION missing stopTime - using last time, drive cycle is ' + (Math.round((sample.end - sample.beg) / 1000000 / 60 / 60 * 100) / 100) + ' hours');
      }
    });

    // Add _schema samples.
    var schemaSamples = [];
    Object.keys(sampleSets).forEach(function(channelName) {
      var samples = sampleSets[channelName];
      var beg = _.first(samples).beg, end = _.last(samples).end;
      var schemaVal = standardSchema[channelName];
      if (!schemaVal) {
        debug('No schema available for channel ' + channelName +
              ', making one up.');
        schemaVal = {
          channelName: channelName,
          type: 'float',
        };
      }
      schemaSamples.push({ beg: beg, end: end, val: schemaVal });
      debug('compatibility.insertEventBucket: schema ' + channelName + ': ' +
            beg + '..' + end);
    });
    sampleSets['_schema'] = schemaSamples;
    //console.timeEnd('durations');

    // Write samples to dest DB.
    sampleDb.insertSamples(vehicleId, sampleSets, cb);
  } catch (err) {
    cb(err);
  }
}
