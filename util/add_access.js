#!/usr/bin/env node

// Add user access to a vehicle, fleet, or class.

var log = require('console').log;
var mongodb = require('mongodb');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var _ = require('underscore');
_.mixin(require('underscore.string'));

var UserDb = require('../user_db.js').UserDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo:///service-samples')
    .default('vehicleId')
    .default('fleetId')
    .default('userId')
    .default('teamId')
    .boolean('admin')
    .boolean('config')
    .argv;

function errCheck(err, op, done) {
  if (err) {
    error('At ' + op + ':\n' + err.stack);
    process.exit(1);
  } else if (done) process.exit(0);
}

if ((!argv.userId && !argv.teamId)
    || (argv.userId && argv.teamId)) {
  error('You must include --userId or --teamId, not both.');
  process.exit(1);
}

if ((!argv.vehicleId && !argv.fleetId)
    || (argv.vehicleId && argv.fleetId)) {
  error('You must include --vehicleId or --fleetId, not both.');
  process.exit(1);
}

var ids = {
  userId: argv.userId,
  teamId: argv.teamId,
  vehicleId: argv.vehicleId,
  fleetId: argv.fleetId
};

// Connect to DB.
mongodb.connect(argv.db, {
                  server: { poolSize: 4 },
                  db: { native_parser: false },
                }, function (err, db) {
  errCheck(err, 'connect('+argv.db+')');
  new UserDb(db, { ensureIndexes: false }, function (err, userDb) {
      errCheck(err, 'new userDb');
      var opts = {
        admin: argv.admin,
        config: argv.config,
      };
      userDb.addAccess(ids, opts, function (err) {
        errCheck(err, 'addAccess('+inspect(ids)+')', true);
      });
  });
});


