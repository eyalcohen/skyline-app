#!/usr/bin/env node

// Add user access to a vehicle, fleet, or class.

var log = require('console').log;
var mongodb = require('mongodb');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var util = require('util'), debug = util.debug, inspect = util.inspect;
var _ = require('underscore');
_.mixin(require('underscore.string'));

var UserDb = require('../user_db.js').UserDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongo:///service-samples')
    .demand('targetId')
    .demand('userId')
    .default('type', 'vehicles')
    .boolean('admin')
    .boolean('config')
    .argv;

function errCheck(err, op, done) {
  if (err) {
    debug('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  } else if (done) process.exit(0);
}


// Connect to DB.
mongodb.connect(argv.db, {
                  server: { poolSize: 4 },
                  db: { native_parser: false },
                }, function(err, db) {
  errCheck(err, 'connect('+argv.db+')');
  new UserDb(db, { ensureIndexes: false }, function (err, userDb) {
      errCheck(err, 'new userDb');
      var opts = {
        type: argv.type,
        admin: argv.admin,
        config: argv.config,
      };
      userDb.addAccess(argv.targetId, new ObjectID(argv.userId),
                        opts, function (err) {
        errCheck(err, 'addAccess('+argv.targetId+', '+argv.userId+')', true);
      });
  });
});


