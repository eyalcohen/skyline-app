#!/usr/bin/env node

// Update existing data to the new
// user, team, vehicle ,fleet format.

var log = require('console').log;
var mongodb = require('mongodb');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

var UserDb = require('../user_db.js').UserDb;
var SampleDb = require('../sample_db.js').SampleDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo:///service-samples')
    .demand('userId')
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  }
}

// Manually define vehicles because we want to add more data
// than what is contained in the original vehicles.
// These are all the vehicles that we have so far.
var vehicles = [
  { "_id" : 1752496064, "title" : "BlueBird-2a" },
  { "_id" : 1916413342, "title" : "BlueBird-2b" },
  { "_id" : 506471902, "title" : "BlueBird-4c" },
  { "_id" : 212893405, "title" : "BlueBird-5a.1" },
  { "_id" : 575141233, "title" : "BlueBird-5b" },

  { "_id" : 4752496064, "title" : "RedBird-2a" },
  { "_id" : 4916413342, "title" : "RedBird-2b" },
  { "_id" : 406471902, "title" : "RedBird-4c" },
  { "_id" : 412893405, "title" : "RedBird-5a.1" },
  { "_id" : 130960143, "title" : "RedBird-5b" },

  { "_id" : 1612707857, "title" : "MM-Alpha No.1" },
  { "_id" : 804445032, "title" : "MM-Alpha No.2" },
  { "_id" : 1282119561, "title" : "MM-Alpha No.3" },
  { "_id" : 1860862813, "title" : "MM-Alpha No.4" },

  { "_id" : 292631378, "title" : "MM-Alpha No.5" },
  { "_id" : 1487910678, "title" : "MM-Alpha No.6" },
  { "_id" : 1897419604, "title" : "MM-Alpha No.7" },
  { "_id" : 537867031, "title" : "MM-Alpha No.8" },
  { "_id" : 1513786801, "title" : "MM-Alpha No.9" },

  { "_id" : 1669705008, "title" : "Toyota Tacoma" },
  { "_id" : 1666504000, "title" : "Yamaha YZF-R6" },
  { "_id" : 414950721, "title" : "Ducati Monster 1100 EVO" },
  { "_id" : 1019788775, "title" : "Kawasaki Ninja 1000" },

  { "_id" : 174037291, "title" : "Valkyrie Jolt" },
  { "_id" : 1826665974, "title" : "Valkyrie Bolt" },
  
  { "_id" : 2033779098, "title" : "2009 Mission One", 
    "description" : "Data from Isle of Man", "nickname" : "isleofman" },
  { "_id" : 3094281482, "title" : "2011 Mission R",
    "description" : "2011 TTXGP / FIM e-Power race vehicle at Lagnua Seca", "nickname" : "lagunaseca" },
];

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
    // userDb.collections.users.dropIndexes(this.parallel());
    userDb.collections.vehicles.dropIndexes(this.parallel());
    userDb.collections.teams.dropIndexes(this.parallel());
    userDb.collections.fleets.dropIndexes(this.parallel());
    // drop collections
    userDb.collections.sessions.drop(this.parallel());
    // userDb.collections.users.drop(this.parallel());
    userDb.collections.vehicles.drop(this.parallel());
    userDb.collections.teams.drop(this.parallel());
    userDb.collections.fleets.drop(this.parallel());
  },
  // Add newly formatted vehicles.
  function (err) {
    // err if cols do not exist - but that's okay
    log('\nDeleted all sessions, users, and vehicles and their indexes.');
    var next = this;
    
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
      title: 'Project Alpha',
      description: '',
      nickname: 'mm-alpha',
      vehicles: [1612707857, 804445032, 1282119561, 1860862813,
                292631378, 1487910678, 1897419604, 537867031, 1513786801],
    }, this.parallel());
    userDb.createFleet({
      title: 'MM Historical',
      description: '',
      nickname: 'mm-historical',
      vehicles: [2033779098, 3094281482],
    }, this.parallel());
    userDb.createFleet({
      title: 'Valkyrie',
      description: '',
      nickname: 'mm-valkyrie',
      vehicles: [174037291, 1826665974],
    }, this.parallel());
  },
  // Create the mish-mos team based on the
  // ridemission.com domain.
  function (err, rac, his, val) {
    errCheck(err, 'createFleets()');
    log('\nCreated fleet: ' + inspect(rac));
    log('\nCreated fleet: ' + inspect(his));
    log('\nCreated fleet: ' + inspect(val));
    var next = this;
    userDb.createTeam({
      title: 'Mission Motors',
      description: '',
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
        fleetId: rac._id, 
      };
      var two = {
        teamId: team._id,
        fleetId: his._id, 
      };
      var three = {
        teamId: team._id,
        fleetId: val._id, 
      };
      log('\nAdded access: ' + inspect(one));
      userDb.addAccess(one, { note: true }, function (err) {
        if (err) next(err);
        else {
          log('\nAdded access: ' + inspect(two));
          userDb.addAccess(two, { note: true }, function (err) {
            if (err) next(err);
            else {
              log('\nAdded access: ' + inspect(three));
              userDb.addAccess(three, { note: true }, next);
            }
          });
        }
      });
    });
  },

  function () {
    userDb.createFleet({
      title: 'BlueBirds',
      description: '',
      nickname: 'blue',
      vehicles: [1752496064, 1916413342, 506471902, 212893405, 575141233],
    }, this.parallel());
    userDb.createFleet({
      title: 'RedBirds',
      description: '',
      nickname: 'red',
      vehicles: [4752496064, 4916413342, 406471902, 412893405, 130960143],
    }, this.parallel());
  },
  // Create the mish-mos team based on the
  // ridemission.com domain.
  function (err, blue, red) {
    errCheck(err, 'createFleets()');
    log('\nCreated fleet: ' + inspect(blue));
    log('\nCreated fleet: ' + inspect(red));
    var next = this;
    userDb.createTeam({
      title: 'Bird Engineers',
      description: '',
      nickname: 'bluebirds',
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
        fleetId: blue._id, 
      };
      var two = {
        teamId: team._id,
        fleetId: red._id, 
      };
      log('\nAdded access: ' + inspect(one));
      userDb.addAccess(one, { note: true }, function (err) {
        errCheck(err);
        log('\nAdded access: ' + inspect(two));
        userDb.addAccess(two, { note: true }, next);
      });
    });
  },

  function (err) {
    userDb.createFleet({
      title: 'My Motorcycles',
      description: '',
      nickname: 'my-bikes',
      vehicles: [1666504000, 414950721, 1019788775],
    }, this);
  },

  function (err, bikes) {
    var self = this;
    userDb.collections.users.findAndModify({ _id: argv.userId }, [],
                              { $set: { vehicles: [], fleets: [] }},
                              {}, function (err, usr) {      
      errCheck(err, 'findingUser');
      var one = {
        userId: argv.userId,
        fleetId: bikes._id,
      };
      var two = {
        userId: argv.userId,
        vehicleId: 1669705008,
      };
      log('\nAdded access: ' + inspect(one));
      userDb.addAccess(one, { note: true }, function (err) {
        errCheck(err);
        log('\nAdded access: ' + inspect(two));
        userDb.addAccess(two, { note: true }, self);
      });
    });
  },

  // Notes are associated with old users.
  // Delete them all. They're not important yet.
  // Finding notes...
  // function (err) {
  //   errCheck(err, 'addAccess()');
  //   log('\nLooking for notes...');
  //   var colls = _.values(sampleDb.realCollections);
  //   var _next = _.after(colls.length, this);
  //   _.each(colls, function (collection) {
  //     collection.find({ chn: '_note' }).toArray(function (err, ns) {
  //       if (ns && ns.length > 0) {
  //         var __next = _.after(ns.length, _next);
  //         _.each(ns, function (n) {
  //           collection.remove({ _id: n._id }, function (err) {
  //             errCheck(err, 'removeNote(' + n._id + ')');
  //             log('\nRemoved note: ' + inspect(n));
  //             __next();
  //           });
  //         });
  //       } else _next(err);
  //     });
  //   });
  // },

  function (err) {
    var _next = _.after(vehicles.length, this);
    errCheck(err, 'blah');
    var chns = ['_drive', '_charge', '_error', '_warning'];
    _.each([ { _id: 130960143 } ], function (veh) {
    // _.each(vehicles, function (veh) {
      var samps = { _drive: [], _charge: [], _error: [], _warning: [] };
      for (var i = 0, len = Math.ceil(Math.random() * 10); i < len; ++i) {
        var c = pickone(chns);
        var s;
        var end = Math.round((Date.now() - (Math.random() * 60*60*24*7*1000)) * 1000);
        switch (c) {
          case '_drive':
            var beg = end - Math.random() * 60*60*24*1000*1000;
            s = {
              beg: beg,
              end: end,
              val: {
                drive_kWh: Math.random() * 100,
                drive_km: Math.random() * 100,
              },
            };
            break;
          case '_charge':
            var beg = end - Math.random() * 60*60*24*1000*1000;
            s = {
              beg: beg,
              end: end,
              val: {
                charge_kWh: Math.random() * 100,
                wall_A: Math.round(Math.random() * 100),
                wall_V: Math.round(Math.random() * 100),
              },
            };
            break;
          case '_error':
            var beg = end - Math.random() * 60*10*1000*1000;
            s = {
              beg: beg,
              end: end,
              val: {
                channels: ['blah'],
                humanName: pickone(['Pack SoC below 5%', 'Pack SoC below 1%',
                                    'Motor phase overcurrent', 'Battery module 3 disconnected',
                                    'Battery module 1 disconnected', 'Battery module 2 disconnected' ]),
              },
            };
            break;
          case '_warning':
            var beg = end - Math.random() * 60*10*1000*1000;
            s = {
              beg: beg,
              end: end,
              val: {
                channels: ['blah'],
                humanName: pickone(['Pack SoC below 15%', 'Pack SoC below 10%',
                                  'High cell imbalance in module 6', 'High cell imbalance in module 4',
                                  'High cell imbalance in module 5']),
              },
            };
            break;
        }
        log('\nAdded a ' + c + ' to ' + veh.title + ': ' + inspect(s));
        samps[c].push(s);
      }
      sampleDb.insertSamples(veh._id, samps, {}, _next);
    });

    function pickone(a) {
      var i = Math.floor(Math.random() * a.length);
      return a[i];
    }

  },
  // Done.
  function (err) {
    errCheck(err, 'adding samples');
    log('\nAll done!\n');
    process.exit(0);
  }
);

























