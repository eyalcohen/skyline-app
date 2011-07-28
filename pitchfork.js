#!/usr/bin/env node

// Transfer data from old DB format to new DB format.

var log = require('console').log;
var debug = require('util').debug;
var mongodb = require('mongodb');
var Step = require('step');
var util = require('util');
var _ = require('underscore');

var SampleDb = require('./sample_db.js').SampleDb;
var compatibility = require('./compatibility.js');

var argv = require('optimist')
    .default('srcDb', 'mongo://localhost:27017/service-development')
    .default('destDb', 'mongo://localhost:27017/service-samples')
    .boolean('ensureIndexes')
    .default('ensureIndexes', true)
    .argv;

function errCheck(err, op) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

// Connect to source DB, eventbuckets collection.
mongodb.connect(argv.srcDb, {
                  server: { poolSize: 4 },
                }, function(err, srcDb) {
errCheck(err, 'connect('+argv.srcDb+')');

// Connect to dest DB, samples collection.
mongodb.connect(argv.destDb, {
                  server: { poolSize: 4 },
                }, function(err, destDb) {
errCheck(err, 'connect('+argv.destDb+')');
new SampleDb(destDb, { ensureIndexes: argv.ensureIndexes },
             function (err, sampleDb) {
errCheck(err, 'new sampleDb');

srcDb.on('close', function() { debug('srcDb closed!'); });
destDb.on('close', function() { debug('destDb closed!'); });

function stepErr(op) {
  return function(err) {
    if (err)
      errCheck(err, op);
    else
      this();
  };
}

debug('entering step!');
Step(

  function getUserCollections() {
    debug('getUserCollections');
    srcDb.collection('users', this.parallel());
    destDb.collection('users', this.parallel());
  },
  function convertUsers(err, srcUsersCollection, destUsersCollection) {
    log('Converting users...');
    var next = this;
    srcUsersCollection.find({}).each(function(err, user) {
      errCheck(err, 'srcUsersCollection.find');
      if (!user) {
        next(err);
      } else {
        destUsersCollection.insert(user);
      }
    });
  }, stepErr('convertUsers'),

  function getVehicleCollections() {
    srcDb.collection('vehicles', this.parallel());
    destDb.collection('vehicles', this.parallel());
  },
  function convertVehicles(err, srcVehiclesCollection, destVehiclesCollection) {
    log('Converting vehicles...');
    var next = this;
    srcVehiclesCollection.find({}).each(function(err, veh) {
      errCheck(err, 'srcVehiclesCollection.find');
      if (!veh) {
        next(err);
      } else {
        // Use 32-bit ids.
        veh._id = compatibility.vehicleIdFromObjectId(veh._id);
        destVehiclesCollection.insert(veh);
      }
    });
  }, stepErr('convertVehicles'),

  function getEventbucketCollection() {
    srcDb.collection('eventbuckets', this);
  },
  function convertDriveCycles(err, eventbucketsCollection) {
    errCheck(err, 'getEventbucketCollection');

    log('Converting drive cycles...');
    var srcCursor = eventbucketsCollection.find({}, [], { sort: ['_id'] } );
    var next = this;
    (function processDoc() {
      srcCursor.nextObject(function(err, doc) {
        errCheck(err, 'srcCursor.nextObject');

        if (!doc) {
          next();
          return;
        }

        // Process a drive cycle.
        compatibility.insertEventsProto(sampleDb, doc, {}, function(err) {
          if (err) {
            debug('Error processing event:\n' + err.stack);
            process.exit(1);
          }
          // On to next drive cycle.
          process.nextTick(processDoc);
        });
      })
    })();
  }, stepErr('convertDriveCycles'),

  function closeDbs() {
    log('Closing DBs.');
    srcDb.serverConfig.close(this.parallel());
    destDb.serverConfig.close(this.parallel());
    log('DBs closed.');
  }, function(err) {
    log('All done!  ' + ((err && err.stack) || ''));
    // Flush stdout.
    process.stdout.once('close', function() {
      process.exit(0);
    });
    process.stdout.destroySoon();
  }
);

})})});
