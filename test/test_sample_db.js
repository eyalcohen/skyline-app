#!/usr/bin/env nodeunit

// Run with:
//   node_modules/.bin/nodeunit test/test_sample_db.js
// TODO: you have to kill the test with ^C when it's done for some reason.

var assert = require('assert');
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');

var SampleDb = require('../sample_db.js').SampleDb;

var argv = require('optimist')
    .default('db', 'mongo://localhost:27017/test-samples')
    .argv;

var db, sampleDb;
var finished = 0;

var us = 1;
var ms = 1000 * us;
var s = 1000 * ms;
var m = 60 * s;
var h = 60 * m;
var d = 24 * h;

function deepCopy(o) {
  if (_.isArray(o)) {
    var a = o.slice();
    for (var i in a)
      a[i] = deepCopy(a[i]);
    return a;
  } else if (_.isObject(o)) {
    var n = {};
    for (var prop in o)
      n[prop] = deepCopy(o[prop]);
    return n;
  } else
    return o;
}


//// Test low-level functions ////

exports.testGetLevel = function(test) {
  SampleDb.bucketThresholds.forEach(function(thresh, i) {
    var prevThresh = SampleDb.bucketThresholds[i-1] || 0;
    var nextThresh = SampleDb.bucketThresholds[i+1];
    test.equal(SampleDb.getLevel(thresh), thresh);
    test.equal(SampleDb.getLevel(thresh + 1), thresh);
    if (nextThresh != null)
      test.equal(SampleDb.getLevel(nextThresh - 1), thresh);
    test.equal(SampleDb.getLevel(thresh - 1), prevThresh);
  });
  test.done();
};

exports.testMergeOverlappingSamples = function(test) {
  var beforeMerge = [
    // Adjacent.
    { beg: 100, end: 200, val: 1 },
    { beg: 200, end: 300, val: 1 },
    // Overlap.
    { beg: 1000, end: 1200, val: 2 },
    { beg: 1100, end: 1300, val: 2 },
    // Equal.
    { beg: 2000, end: 2200, val: 3 },
    { beg: 2000, end: 2200, val: 3 },
    // Subsumes.
    { beg: 3000, end: 3500, val: 4 },
    { beg: 3100, end: 3400, val: 4 },
    // Subsumes2.
    { beg: 4000, end: 4400, val: 5 },
    { beg: 4000, end: 4500, val: 5 },
    // Subsumes3.
    { beg: 5000, end: 5500, val: 6 },
    { beg: 5000, end: 5400, val: 6 },
    // Min.
    { beg: 6100, end: 6200, val: 7, min: 5 },
    { beg: 6200, end: 6300, val: 7, min: 5 },
    // Max.
    { beg: 7100, end: 7200, val: 8, max: 10 },
    { beg: 7200, end: 7300, val: 8, max: 10 },
    // Min & Max.
    { beg: 8100, end: 8200, val: 9, min: 5, max: 12 },
    { beg: 8200, end: 8300, val: 9, min: 5, max: 12 },
    // Structured value.
    { beg: 9000, end: 9100, val: { foo: 'bar', merge: false } },
    { beg: 9100, end: 9300, val: { foo: 'bar', merge: false } },
    // Overlapping, multiple at same time.
    { beg: 10000, end: 10100, val: { foo: 'bar', merge: false } },
    { beg: 10000, end: 10100, val: { foo: 'baz', merge: true } },
    { beg: 10100, end: 10300, val: { foo: 'bar', merge: false } },
    { beg: 10100, end: 10300, val: { foo: 'baz', merge: true } },
  ];
  var afterMerge = deepCopy(beforeMerge);
  SampleDb.mergeOverlappingSamples(afterMerge);
  test.deepEqual(afterMerge, [
    { beg: 100, end: 300, val: 1 },
    { beg: 1000, end: 1300, val: 2 },
    { beg: 2000, end: 2200, val: 3 },
    { beg: 3000, end: 3500, val: 4 },
    { beg: 4000, end: 4500, val: 5 },
    { beg: 5000, end: 5500, val: 6 },
    { beg: 6100, end: 6300, val: 7, min: 5 },
    { beg: 7100, end: 7300, val: 8, max: 10 },
    { beg: 8100, end: 8300, val: 9, min: 5, max: 12 },
    { beg: 9000, end: 9300, val: { foo: 'bar', merge: false } },
    { beg: 10000, end: 10300, val: { foo: 'bar', merge: false } },
    { beg: 10000, end: 10300, val: { foo: 'baz', merge: true } },
  ]);
  test.done();
};

exports.testMergeOverlappingSamplesNoMerge = function(test) {
  var beforeMerge = [
    // No overlap.
    { beg: 10100, end: 10200, val: 10 },
    { beg: 10201, end: 10300, val: 10 },
    // Different value.
    { beg: 11100, end: 11200, val: 11 },
    { beg: 11200, end: 11300, val: 10 },
    // Different min.
    { beg: 12100, end: 12200, val: 12, min: 5 },
    { beg: 12200, end: 12300, val: 12, min: 6 },
    // Different max.
    { beg: 13100, end: 13200, val: 12, max: 15 },
    { beg: 13200, end: 13300, val: 12, min: 16 },
  ];
  var afterMerge = deepCopy(beforeMerge);
  SampleDb.mergeOverlappingSamples(afterMerge);
  test.deepEqual(afterMerge, beforeMerge);
  test.done();
};

exports.testSplitSamplesByTime = function(test) {
  var beforeSplit = {
    chan1: [
      { beg: 0, end: 1, val: 1 },
      { beg: 10, end: 11, val: 4 },
      { beg: 20, end: 29, val: 9 },
      { beg: 30, end: 39, val: 12 },
      { beg: 40, end: 49, val: 13 },
      { beg: 60, end: 69, val: 17 },
    ],
    chan2: [
      { beg: 2, end: 4, val: 2 },
      { beg: 11, end: 12, val: 5 },
      { beg: 20, end: 26, val: 8 },
      { beg: 34, end: 39, val: 11 },
      { beg: 42, end: 47, val: 14 },
      { beg: 50, end: 55, val: 15 },
      { beg: 62, end: 62, val: 18 },
    ],
    chan3: [
      { beg: 7, end: 9, val: 3 },
      { beg: 12, end: 13, val: 6 },
      { beg: 20, end: 22, val: 7 },
      { beg: 37, end: 39, val: 10 },
      { beg: 52, end: 59, val: 16 },
      { beg: 64, end: 50, val: 19 },
    ],
  };
  var expected = [
    // Isolated samples.
    { beg: 0, end: 1, val: { chan1: { beg: 0, end: 1, val: 1 }, } },
    { beg: 2, end: 4, val: { chan2: { beg: 2, end: 4, val: 2 }, } },
    { beg: 7, end: 9, val: { chan3: { beg: 7, end: 9, val: 3 }, } },
    // Adjacent samples.
    { beg: 10, end: 11, val: { chan1: { beg: 10, end: 11, val: 4 }, } },
    { beg: 11, end: 12, val: { chan2: { beg: 11, end: 12, val: 5 }, } },
    { beg: 12, end: 13, val: { chan3: { beg: 12, end: 13, val: 6 }, } },
    // Same begin.
    { beg: 20, end: 22, val: {
        chan1: { beg: 20, end: 29, val: 9 },
        chan2: { beg: 20, end: 26, val: 8 },
        chan3: { beg: 20, end: 22, val: 7 }, } },
    { beg: 22, end: 26, val: {
        chan1: { beg: 20, end: 29, val: 9 },
        chan2: { beg: 20, end: 26, val: 8 }, } },
    { beg: 26, end: 29, val: {
        chan1: { beg: 20, end: 29, val: 9 }, } },
    // Same end.
    { beg: 30, end: 34, val: {
        chan1: { beg: 30, end: 39, val: 12 }, } },
    { beg: 34, end: 37, val: {
        chan1: { beg: 30, end: 39, val: 12 },
        chan2: { beg: 34, end: 39, val: 11 }, } },
    { beg: 37, end: 39, val: {
        chan1: { beg: 30, end: 39, val: 12 },
        chan2: { beg: 34, end: 39, val: 11 },
        chan3: { beg: 37, end: 39, val: 10 }, } },
    // Subsumed.
    { beg: 40, end: 42, val: { chan1: { beg: 40, end: 49, val: 13 }, } },
    { beg: 42, end: 47, val: {
        chan1: { beg: 40, end: 49, val: 13 },
        chan2: { beg: 42, end: 47, val: 14 }, } },
    { beg: 47, end: 49, val: { chan1: { beg: 40, end: 49, val: 13 }, } },
    // Overlapping.
    { beg: 50, end: 52, val: { chan2: { beg: 50, end: 55, val: 15 }, } },
    { beg: 52, end: 55, val: {
        chan2: { beg: 50, end: 55, val: 15 },
        chan3: { beg: 52, end: 59, val: 16 }, } },
    { beg: 55, end: 59, val: { chan3: { beg: 52, end: 59, val: 16 }, } },
    // Zero-duration.
    { beg: 60, end: 62, val: { chan1: { beg: 60, end: 69, val: 17 }, } },
    { beg: 62, end: 62, val: {
        chan1: { beg: 60, end: 69, val: 17 },
        chan2: { beg: 62, end: 62, val: 18 } } },
    { beg: 62, end: 64, val: { chan1: { beg: 60, end: 69, val: 17 }, } },
    { beg: 64, end: 64, val: {
        chan1: { beg: 60, end: 69, val: 17 },
        chan3: { beg: 64, end: 50, val: 19 } } },
    { beg: 64, end: 69, val: { chan1: { beg: 60, end: 69, val: 17 }, } },
  ];
  var afterSplit = SampleDb.splitSamplesByTime(beforeSplit);
  test.deepEqual(afterSplit, expected);

  var before2 = {
    lat: [{beg:1314376952845000,end:1314376952845000,val:37.773921966552734}],
    lng: [{beg:1314376952851000,end:1314376952851000,val:-122.4073715209961}],
  };
  var expected2 = [
    { beg:1314376952845000,end:1314376952845000, val:
      {lat:{beg:1314376952845000,end:1314376952845000,val:37.773921966552734}}
    },
    { beg:1314376952851000,end:1314376952851000, val:
      {lng:{beg:1314376952851000,end:1314376952851000,val:-122.4073715209961}}
    },
  ];
  test.deepEqual(SampleDb.splitSamplesByTime(before2), expected2);
  test.done();
};


exports.testBuildChannelTree = function(test) {
  var schema = [
    { channelName: 'no_hierarchy', humanName: 'Blah blah', type: 'string' },
    { channelName: 'gps/speed_m_s', humanName: 'Speed',
      description: 'GPS: speed in m/s', units: 'm/s', type: 'float' },
    { channelName: 'foo.bar', humanName: 'i pity the', type: 'enum' },
    { channelName: 'gps/latitude_deg', humanName: 'GPS Latitude',
      units: '°', type: 'float' },
    { channelName: 'gps/satellites.count', humanName: 'Satellite count',
      type: 'int' },
  ];
  var samples = schema.map(function(s) { return { beg: 5, end: 9, val: s }; });
  var expected = [
    { shortName: 'no_hierarchy',
      channelName: 'no_hierarchy',
      humanName: 'Blah blah',
      type: 'string' },
    { shortName: 'gps/',
      type: 'category',
      sub: [
        { shortName: 'speed_m_s',
          channelName: 'gps/speed_m_s',
          humanName: 'Speed',
          description: 'GPS: speed in m/s',
          units: 'm/s',
          type: 'float' },
        { shortName: 'latitude_deg',
          channelName: 'gps/latitude_deg',
          humanName: 'GPS Latitude',
          units: '°',
          type: 'float' },
        { shortName: 'satellites.',
          type: 'category',
          sub: [
            { shortName: 'count',
              channelName: 'gps/satellites.count',
              humanName: 'Satellite count',
              type: 'int' } ] } ] },
    { shortName: 'foo.',
      type: 'category',
      sub: [
        { shortName: 'bar',
          channelName: 'foo.bar',
          humanName: 'i pity the',
          type: 'enum' } ] },
  ];
  function setValid(a, valid) {
    a.forEach(function(d) {
      d.valid = valid;
      if ('sub' in d)
        setValid(d.sub, valid);
    });
  };
  setValid(expected, [ { beg: 5, end: 9 } ]);
  test.deepEqual(SampleDb.buildChannelTree(samples), expected);

  // Add additional schema elements - we should pick the later versions.
  var samples2 = _(samples).map(function munge(s) {
    s = deepCopy(s);
    s.beg = 1;
    s.end = 4;
    s.val.humanName = s.val.humanName + ' old';
    return s;
  }).concat(samples);
  setValid(expected, [ { beg: 1, end: 4 }, { beg: 5, end: 9 } ]);
  test.deepEqual(SampleDb.buildChannelTree(samples2), expected);

  test.done();
};


exports.testTrimSamples = function(test) {
  test.deepEqual(SampleDb.trimSamples([], 100, 200), []);
  var samples = [
    { beg: 100, end: 120, val: 0 },
    { beg: 120, end: 125, val: 1 },
    { beg: 130, end: 130, val: 2 },
    { beg: 130, end: 140, val: 3 },
    { beg: 150, end: 180, val: 4 },
  ];
  test.deepEqual(SampleDb.trimSamples(samples, 0, 500), samples);
  test.deepEqual(SampleDb.trimSamples(samples, 100, 180), samples);
  test.deepEqual(SampleDb.trimSamples(samples, 128, 180), samples.slice(2));
  test.deepEqual(SampleDb.trimSamples(samples, 100, 128), samples.slice(0, 2));
  test.deepEqual(SampleDb.trimSamples(samples, 110, 170),
                 [ { beg: 110, end: 120, val: 0 },
                   { beg: 120, end: 125, val: 1 },
                   { beg: 130, end: 130, val: 2 },
                   { beg: 130, end: 140, val: 3 },
                   { beg: 150, end: 170, val: 4 } ]);
  test.deepEqual(SampleDb.trimSamples(samples, 122, 135),
                 [ { beg: 122, end: 125, val: 1 },
                   { beg: 130, end: 130, val: 2 },
                   { beg: 130, end: 135, val: 3 } ]);
  test.deepEqual(SampleDb.trimSamples(samples, 130, 135),
                 [ { beg: 130, end: 130, val: 2 },
                   { beg: 130, end: 135, val: 3 } ]);
  test.deepEqual(SampleDb.trimSamples(samples, 122, 130),
                 [ { beg: 122, end: 125, val: 1 },
                   { beg: 130, end: 130, val: 2 } ]);
  test.deepEqual(SampleDb.trimSamples(samples, 130, 130),
                 [ { beg: 130, end: 130, val: 2 } ]);
  test.deepEqual(SampleDb.trimSamples(samples, 0, 50), [ ]);
  test.deepEqual(SampleDb.trimSamples(samples, 0, 100), [ ]);
  test.deepEqual(SampleDb.trimSamples(samples, 180, 300), [ ]);
  test.deepEqual(SampleDb.trimSamples(samples, 200, 300), [ ]);
  test.done();
};


//// Test DB functionality ////

var db, sampleDb;

function setupDbFirst(cb) {
  return function(test) {
    if (sampleDb) {
      cb(test);
    } else Step(
      // Initialization.
      function connectToDb() {
        mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
      },
      function dropDb(err, db_) {
        test.equal(err, null, 'mongodb.connect(' + argv.db + ')');
        db = db_;
        db.dropDatabase(this);
      }, function createSampleDb(err) {
        test.equal(err, null, 'mongodb.connect');
        new SampleDb(db, { ensureIndexes: true }, this);
      }, function gotSampleDb(err, sampleDb_) {
        test.equal(err, null, 'new SampleDb');
        sampleDb = sampleDb_;
        cb(test);
      }
    );
  };
}

exports.openDb = setupDbFirst(function(test) {
  test.done();
});

exports.testSimpleInsert = setupDbFirst(function(test) {
  var sampleSet1 = {
    testSimpleInsert: [
      { beg: 1 * s, end: 2 * s, val: 100 },
      { beg: 2 * s, end: 3 * s, val: 200 },
      { beg: 3 * s, end: 4 * s, val: 300 },
      { beg: 4 * s, end: 5 * s, val: 400 },
      { beg: 5 * s, end: 6 * s, val: 500 },
    ],
  };
  var sampleSet2 = {
    testSimpleInsert: [
      { beg: 6 * s, end: 7 * s, val: -600 },
      { beg: 7 * s, end: 8 * s, val: -700 },
      { beg: 8 * s, end: 9 * s, val: 800 },
      { beg: 9 * s, end: 10 * s, val: 900 },
    ],
  };
  Step(
    function insert() {
      sampleDb.insertSamples(123, sampleSet1, { merge: false }, this);
    },
    function findReal(err) {
      test.equal(err, null);
      sampleDb.realCollections[500000].findOne(
          { veh: 123, chn: 'testSimpleInsert', buk: 0 },
          { fields: { _id: 0 } },
          this);
    }, function checkReal(err, real) {
      test.equal(err, null);
      test.deepEqual(real, {
        veh: 123, chn: 'testSimpleInsert', buk: 0,
        beg: [ 1000000, 1000000, 1000000, 1000000, 1000000 ],
        end: [ 2000000, 1000000, 1000000, 1000000, 1000000 ],
        val: [ 100, 200, 300, 400, 500 ],
      });
      this();
    }, function checkSyn(err) {
      var parallel = this.parallel;
      SampleDb.syntheticDurations.forEach(function(duration) {
        var next = parallel();
        sampleDb.syntheticCollections[duration].findOne(
            { veh: 123, chn: 'testSimpleInsert' },
            { fields: { _id: 0 } },
            function(err, syn) {
          test.equal(err, null);
          test.deepEqual(syn, duration <= 1 * s ? null : {
            veh: 123, chn: 'testSimpleInsert', buk: 0,
            ovr: [ 5000000 ], sum: [ 1500000000 ],
            min: [ 100 ], max: [ 500 ],
          });
          next();
        });
      });
    },

    // Insert more and make sure synthetic updating works properly.
    function insert2() {
      sampleDb.insertSamples(123, sampleSet2, { merge: false }, this);
    },
    function checkSyn(err) {
      test.equal(err, null);
      var parallel = this.parallel;
      SampleDb.syntheticDurations.forEach(function(duration) {
        var next = parallel();
        sampleDb.syntheticCollections[duration].findOne(
            { veh: 123, chn: 'testSimpleInsert' },
            { fields: { _id: 0 } },
            function(err, syn) {
          test.equal(err, null);
          test.deepEqual(syn, duration <= 1 * s ? null : {
            veh: 123, chn: 'testSimpleInsert', buk: 0,
            ovr: [ 9000000 ], sum: [ 1900000000 ],
            min: [ -700 ], max: [ 900 ],
          });
          next();
        });
      });
    },

    // Make sure fetching real samples works.
    function fetchReal() {
      sampleDb.fetchSamples(123, 'testSimpleInsert', {}, this);
    }, function checkReal(err, samples) {
      test.equal(err, null);
      var expected =
          sampleSet1.testSimpleInsert.concat(sampleSet2.testSimpleInsert);
      test.deepEqual(samples, expected);
      this();
    },

    test.done
  );
});

exports.testInsertMerging = setupDbFirst(function(test) {
  var schema = [
    { beg: 100, end: 5500,
      val: { channelName: 'testInsertMerging1', type: 'int', merge: true } },
    { beg: 100, end: 5500,
      val: { channelName: 'testInsertMerging2', type: 'int', merge: true } },
  ];
  var beforeMerge = [
    // Adjacent.
    { beg: 100, end: 200, val: 1 },
    { beg: 200, end: 300, val: 1 },
    // Overlap.
    { beg: 1000, end: 1200, val: 2 },
    { beg: 1100, end: 1300, val: 2 },
    // Equal.
    { beg: 2000, end: 2200, val: 3 },
    { beg: 2000, end: 2200, val: 3 },
    // Subsumes.
    { beg: 3000, end: 3500, val: 4 },
    { beg: 3100, end: 3400, val: 4 },
    // Subsumes2.
    { beg: 4000, end: 4400, val: 5 },
    { beg: 4000, end: 4500, val: 5 },
    // Subsumes3.
    { beg: 5000, end: 5500, val: 6 },
    { beg: 5000, end: 5400, val: 6 },
  ];
  var evenSamples = beforeMerge.filter(function(s, i) { return i % 2 == 0; });
  var oddSamples = beforeMerge.filter(function(s, i) { return i % 2 == 1; });
  function fixSchemaTimes(sampleSet) {
    _.forEach(sampleSet, function(val, key) {
      var schema = _.find(sampleSet['_schema'],
                          function(s){ return s.val.channelName == key });
      if (!schema) return;
      schema.beg = _.first(val).beg;
      schema.end = _.last(val).end;
    });
  }
  var sampleSet1 = {
    '_schema': deepCopy(schema),
    testInsertMerging1: oddSamples,
    testInsertMerging2: evenSamples,
  };
  var sampleSet2 = {
    '_schema': deepCopy(schema),
    testInsertMerging1: evenSamples,
    testInsertMerging2: oddSamples,
  };
  fixSchemaTimes(sampleSet1);
  fixSchemaTimes(sampleSet2);
  var expected = [
    { beg: 100, end: 300, val: 1 },
    { beg: 1000, end: 1300, val: 2 },
    { beg: 2000, end: 2200, val: 3 },
    { beg: 3000, end: 3500, val: 4 },
    { beg: 4000, end: 4500, val: 5 },
    { beg: 5000, end: 5500, val: 6 },
  ];
  Step(
    function insert1() {
      sampleDb.insertSamples(123, sampleSet1, { merge: true }, this);
    },
    function insert2(err) {
      test.equal(err, null);
      sampleDb.insertSamples(123, sampleSet2, { merge: true }, this);
    }, function fetchReal1(err) {
      test.equal(err, null);
      sampleDb.fetchSamples(123, 'testInsertMerging1', {}, this);
    }, function checkReal1(err, samples) {
      test.equal(err, null);
      test.deepEqual(samples, expected);
      this();
    }, function fetchReal2(err) {
      test.equal(err, null);
      sampleDb.fetchSamples(123, 'testInsertMerging2', {}, this);
    }, function checkReal2(err, samples) {
      test.equal(err, null);
      test.deepEqual(samples, expected);
      this();
    }, function fetchSchema(err) {
      test.equal(err, null);
      sampleDb.fetchSamples(123, '_schema', {}, this);
    }, function checkReal2(err, samples) {
      test.equal(err, null);
      samples = samples.filter(function(s) {
        return s.val.channelName.match(/^testInsertMerging/);
      });
      // There should only be a single _schema sample for each channel.
      samples.sort(function(s1, s2) {
        return s1.val.channelName.localeCompare(s2.val.channelName);
      });
      test.deepEqual(samples, schema);
      this();
    },

    test.done
  );
});

exports.testFetchMergedSamples = setupDbFirst(function(test) {
  // real bucket thresholds: 0s, 500 us, 5ms, ...
  // synthetic bucket thresholds: 100 us, 1 ms, 10ms, ...
  function s(beg, dur, val, min, max) {
    if (min == null && max == null)
      return { beg: beg, end: beg + dur, val: val };
    else
      return { beg: beg, end: beg + dur, val: val, min: min, max: max };
  }
  var samples1 = [
    // Bucket-aligned, equal to bucket duration threshold.
    s(11000, 500, 10),
    s(11500, 500, 20),
    s(12000, 500, 30),
    s(12500, 500, 40),
    // Below bucket duration threshold, contiguous.
    s(21200, 400, 10),
    s(21600, 400, 20),
    s(22000, 400, 30),
    s(22400, 400, 40),
    // Straddle, contiguous.
    s(31200, 400, 10),
    s(31600, 600, 20),
    s(32200, 400, 30),
    s(32600, 600, 40),
  ];
  var beg = _.first(samples1).beg, end = _.last(samples1).end;
  var expectedSyn1ms = [
    // Bucket-aligned, equal to bucket duration threshold.
    // Below bucket duration threshold, contiguous.
    s(21000, 1000, 15, 10, 20),
    s(22000, 1000, 35, 30, 40),
    // Straddle, contiguous.
    s(31000, 1000, 10, 10, 10),
    s(32000, 1000, 30, 30, 30),
  ];
  var expectedMerged1ms = [
    // Bucket-aligned, equal to bucket duration threshold.
    s(11000, 500, 10),
    s(11500, 500, 20),
    s(12000, 500, 30),
    s(12500, 500, 40),
    // Below bucket duration threshold, contiguous.
    s(21000, 1000, 15, 10, 20),
    s(22000, 1000, 35, 30, 40),
    // Straddle, contiguous.
    s(31000, 600, 10, 10, 10),
    s(31600, 600, 20),
    s(32200, 400, 30, 30, 30),
    s(32600, 600, 40),
  ];
  // TODO: change DB format to have samples only contribute to synthetic
  // samples in a larger real bucket.  This gives cleaner results, and
  // generates much fewer synthetic samples.
  //   s(31000, 600, 10, 10, 10),
  //   s(31600, 600, 20),
  //   s(32200, 400, 30, 30, 30),
  //   s(32600, 600, 40),
  Step(
    function insert1() {
      sampleDb.insertSamples(123, { testFetchMergedSamples: samples1 }, this);
    }, function(err) { test.equal(err, null); this(); },

    function fetchReal() {
      sampleDb.fetchSamples(123, 'testFetchMergedSamples', this);
    }, function checkReal(err, samples) {
      test.equal(err, null);
      test.deepEqual(samples, samples1);
      this();
    },
    function fetchSyn1ms() {
      sampleDb.fetchSamples(123, 'testFetchMergedSamples',
                            { beginTime: beg, endTime: end, synDuration: 1000,
                              type: 'synthetic', getMinMax: true },
                            this);
    }, function checkSyn1ms(err, syn) {
      test.equal(err, null);
      test.deepEqual(syn, expectedSyn1ms);
      this();
    },
    function fetchMerged1ms() {
      sampleDb.fetchSamples(123, 'testFetchMergedSamples',
                            { beginTime: beg, endTime: end, minDuration: 1000,
                              type: 'merged', getMinMax: true },
                            this);
    }, function checkMerged1ms(err, merged) {
      test.equal(err, null);
      test.deepEqual(merged, expectedMerged1ms);
      this();
    },

    test.done
  );
});

exports.testContigRandom = setupDbFirst(function(test) {
  // Create a bunch of contiguous data with random durations, then ensure that
  // merged queries at various resolutions result in contiguous results.
  var samples = [ ];
  var beg = 12345;
  for (var end = beg; end < beg + 10 * s; ) {
    var duration = Math.floor(1 + Math.random() * 20 * ms);
    samples.push({ beg: end, end: end + duration, val: Math.random() });
    end += duration;
  }
  function isContiguous(samples) {
    var result = true;
    samples.forEach(function(s, i) {
      var nextSample = samples[i+1];
      if (nextSample && nextSample.beg != s.end)
        result = false;
    });
    return result;
  }
  test.ok(isContiguous(samples), 'samples contiguous');
  Step(
    function insert() {
      sampleDb.insertSamples(123, { testContigRandom: samples }, this);
    }, function(err) { test.equal(err, null); this(); },

    function fetchReal() {
      sampleDb.fetchSamples(123, 'testContigRandom', this);
    }, function checkReal(err, real) {
      test.equal(err, null);
      test.deepEqual(real, samples);
      this();
    },
    function fetchMerged() {
      var parallel = this.parallel;
      SampleDb.syntheticDurations.forEach(function(synDuration) {
        var next = parallel();
        sampleDb.fetchSamples(123, 'testContigRandom',
                              { beginTime: beg, endTime: end,
                                minDuration: synDuration },
                              function(err, syn) {
          test.equal(err, null);
          test.ok(isContiguous(syn), 'merged ' + synDuration + ' contiguous');
          next();
        });
      });
    },

    test.done
  );
});
