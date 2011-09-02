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
      n[prop] = o[prop];
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
          test.deepEqual(syn, duration <= 1 * s ? undefined : {
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
          test.deepEqual(syn, duration <= 1 * s ? undefined : {
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
    { beg: 0, end: 10000,
      val: { channelName: 'testInsertMerging1', type: 'int', merge: true } },
    { beg: 0, end: 10000,
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
      test.deepEqual(samples, schema);
      this();
    },

    test.done
  );
});

exports.testFetchMergedSamples = setupDbFirst(function(test) {
  // 500 us real bucket thresholds: 0 us, 50 ms, 100 ms, etc.
  // 5 ms real bucket thresholds: 0 ms, 500 ms, 1 s, etc.
  // 1 ms synthetic bucket thresholds: 0 ms, 500 ms, 1 s, etc.
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
    s(11000, 1000, 15, 10, 20),
    s(12000, 1000, 35, 30, 40),
    // Below bucket duration threshold, contiguous.
    s(21000, 1000, 15, 10, 20),
    s(22000, 1000, 35, 30, 40),
    // Straddle, contiguous.
    s(31000, 1000, 15, 10, 20),
    s(32000, 1000, 32, 20, 40),
    s(33000, 1000, 40, 40, 40),
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
    s(31000, 600, 15, 10, 20),
    s(31600, 600, 20),
    s(32200, 400, 32, 20, 40),
    s(32600, 600, 40),
    s(33200, 800, 40, 40, 40),
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
    }, function checkSyn1ms(err, merged) {
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
