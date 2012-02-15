#!/usr/bin/env node

// Update existing data to the new
// user, team, vehicle ,fleet format.

var log = require('console').log;
var mongodb = require('mongodb');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('Step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

var UserDb = require('../user_db.js').UserDb;
var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo:///service-samples')
    .argv;

function errCheck(err, op, done) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  } else if (done) process.exit(0);
}


// Connect to DB.
var userDb, sampleDb;
Step(
  function () {
    var next = this;
    mongodb.connect(argv.db, {
                      server: { poolSize: 4 },
                      db: { native_parser: false },
                    }, function (err, db) {
      errCheck(err, 'connect('+argv.db+')');
      new UserDb(db, { ensureIndexes: false }, next.parallel());
      new SampleDb(db, { ensureIndexes: false }, next.parallel());
    });
  },
  // Delete all sessions, users, and vehicles...
  // (also teams and fleets in case this is re-run)
  function (err, uDb, sDb) {
    userDb = uDb;
    sampleDb = sDb;
    // drop indexes
    userDb.collections.sessions.dropIndexes(this.parallel());
    userDb.collections.users.dropIndexes(this.parallel());
    userDb.collections.vehicles.dropIndexes(this.parallel());
    userDb.collections.teams.dropIndexes(this.parallel());
    userDb.collections.fleets.dropIndexes(this.parallel());
    // drop collections
    userDb.collections.sessions.drop(this.parallel());
    userDb.collections.users.drop(this.parallel());
    userDb.collections.vehicles.drop(this.parallel());
    userDb.collections.teams.drop(this.parallel());
    userDb.collections.fleets.drop(this.parallel());
  },
  // Add newly formatted vehicles.
  function (err) {
    // err if cols do not exist - but that's okay
    log('\nDeleted all sessions, users, and vehicles and their indexes.');
    var next = this;
    // Manually define vehicles because we want to add more data
    // than what is contained in the original vehicles.
    // These are all the vehicles that we have so far.
    var vehicles = [
      { "_id" : 1523932994, "created" : Date("2011-11-15T18:30:07.598Z"), "title" : "Kevin's Test Vehicle", "description" : "I am useless - delete me and my data", "nickname" : "garbage" },
      { "_id" : 1846350188, "created" : Date("2011-11-15T18:47:37.045Z"), "title" : "Monarch 1", "description" : "First tablet used in Monarch", "nickname" : "monarch1" },
      { "_id" : 2033779098, "created" : Date("2011-10-12T19:11:26.298Z"), "title" : "2009 Mission One", "description" : "Data from Isle of Man", "nickname" : "isleofman" },
      { "_id" : 3094281482, "created" : Date("2011-10-12T19:05:33.077Z"), "title" : "2011 Mission R", "description" : "2011 TTXGP / FIM e-Power race vehicle at Lagnua Seca", "nickname" : "lagunaseca" },
      { "_id" : 11592701, "created" : Date("2011-11-28T18:35:59.589Z"), "title" : "Kevin's Home Desktop", "description" : "I am useless - delete me and my data", "nickname" : "garbage" },
      { "_id" : 130960143, "created" : Date("2011-11-30T15:49:32.810Z"), "title" : "Monarch 2", "description" : "Vehicle delivered to Monarch", "nickname" : "monarch2" },
      { "_id" : 588530419, "created" : Date("2011-11-30T19:53:44.363Z"), "title" : "2012 Mission Gen3", "description" : "Everything Gen3 Street", "nickname" : "gen3" },
      { "_id" : 949580622, "created" : Date("2011-12-02T16:47:09.615Z"), "title" : "Kevin's Laptop", "description" : "I am useless - delete me and my data", "nickname" : "garbage" },
      { "_id" : 1636129031, "created" : Date("2012-01-25T21:56:10.065Z"), "title" : "Sander's Laptop", "description" : "I am useless - delete me and my data", "nickname" : "garbage" },
      { "_id" : 1554149089, "created" : Date("2012-01-27T18:02:11.517Z"), "title" : "2011 Fisker Karma", "description" : "Demo vehicle used for the first Fisker meeting", "nickname" : "karma" }
    ];
    if (vehicles.length > 0) {
      var _next = _.after(vehicles.length, next);
      _.each(vehicles, function (veh) {
        userDb.createVehicle(veh, function (err, v) {
          errCheck(err, 'createVehicle(' + inspect(veh) + ')');
          log('\nAdded vehicle: ' + inspect(v));
          _next();
        });
      });
    } else next();
  },
  // Create a fleets for internal vehicles:
  // Monarch and Gen3 plus old canned
  // Laguna Seca and Isle of Man data.
  function () {
    userDb.createFleet({
      title: 'MM Active',
      description: 'Mission Motors vehicles that are actively reporting data to Skyline',
      nickname: 'mm-active',
      vehicles: [588530419, 130960143],
    }, this.parallel());
    userDb.createFleet({
      title: 'MM Canned',
      description: 'Mission Motors vehicles containing old canned data',
      nickname: 'mm-canned',
      vehicles: [2033779098, 3094281482],
    }, this.parallel());
  },
  // Create the mish-mos team based on the
  // ridemission.com domain.
  function (err, activeFleet, cannedFleet) {
    errCheck(err, 'createFleets()');
    log('\nCreated fleet: ' + inspect(activeFleet));
    log('\nCreated fleet: ' + inspect(cannedFleet));
    var next = this;
    userDb.createTeam({
      title: 'Mission Motors',
      description: 'All Mission Motors employees',
      nickname: 'mish-mos',
      domains: ['ridemission.com'],
      users: [],
      admins: [],
      vehicles: [],
      fleets: [],
    }, function (err, team) {
      errCheck(err, 'createTeam()');
      log('\nCreated team: ' + inspect(team));
      // Add mish-mo team read-only access to the both fleets.
      var one = {
        teamId: team._id,
        fleetId: activeFleet._id, 
      };
      var two = {
        teamId: team._id,
        fleetId: cannedFleet._id, 
      };
      log('\nAdded access: ' + inspect(one));
      userDb.addAccess(one, { note: true }, function (err) {
        if (err) next(err);
        else {
          log('\nAdded access: ' + inspect(two));
          userDb.addAccess(two, { note: true }, next);
        }
      });
    });
  },
  // Notes are associated with old users.
  // Delete them all. They're not important yet.
  // Finding notes...
  function (err) {
    errCheck(err, 'addAccess()');
    var colls = _.values(sampleDb.realCollections);
    var _next = _.after(colls.length, this);
    _.each(colls, function (collection) {
      collection.find({ chn: '_note' }).toArray(function (err, ns) {
        if (ns && ns.length > 0) {
          var __next = _.after(ns.length, _next);
          _.each(ns, function (n) {
            collection.remove({ _id: n._id }, function (err) {
              errCheck(err, 'removeNote(' + n._id + ')');
              log('\nRemoved note: ' + inspect(n));
              __next();
            });
          });
        } else _next(err);
      });
    });
  },
  // Rename appstates collection to links
  function (err) {
    var next = this;
    errCheck(err, 'findNotes()');
    userDb.db.collection('appstates', function (err, col) {
      if (err) next(err);
      else {
        col.findOne({}, function (err, doc) {
          if (err || !doc) next(err);
          else {
            log('\nRenamed `appstates` collections to `links`.');
            col.rename('links', next);
          } 
        });
      }
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'renameCollection()', true);
  }
);
