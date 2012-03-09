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
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}


// Connect to DB.
var userDb, sampleDb;
Step(
  function () {
    var next = this;
    mongodb.connect(argv.db, {
                      server: { poolSize: 4 },
                      db: { native_parser: false,
                            reaperTimeout: 600000 },
                    }, function (err, db) {
      errCheck(err, 'connect('+argv.db+')');
      new UserDb(db, { ensureIndexes: false }, next);
    });
  },
  function (err, uDb) {
    userDb = uDb;
    this();
  },
  function () {
    log('\nUpdating users...');
    var next = this;
    userDb.collections.users.find({}).toArray(function (err, users) {
      var _next = _.after(users.length, next);
      _.each(users, function (user) {
        if (user.openId) {
          user.provider = 'google';
          delete user.openId;
          userDb.collections.users.update({ _id: user._id },
                                          user, { safe: true }, _next);
        } else _next();
      });
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'update users');
    log('\nAll done!\n');
    process.exit(0);
  }
);
