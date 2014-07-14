#!/usr/bin/env node
/*
 * userlog.js - get all the logs for a user between two date ranges
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('user', 'User Id')
    .describe('beg', 'Beginning Date')
    .describe('end', 'End Date')
    .describe('n', '# of records')
      .default('n', 100)
    .describe('csv', 'CSV format')
      .boolean('csv')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var com = require('../lib/common');

var user = argv.user ? argv.user : 'anon';
var beg = new Date(argv.beg);
beg = com.isValidDate(beg) ? beg : new Date('5/23/1984');
var end = new Date(argv.end);
end = com.isValidDate(end) ? end : new Date();

console.log(user, beg, end);


boots.start(function (client) {

  Step(
    function () {
      var query = {};
      query.user = user ? user : null;
      query.created = {$gte: beg, $lte: end};
      var opts = {limit: argv.n};
      // Get all datasets.
      db.Logs.list(query, opts, this);
    },
    function (err, docs) {
      if (argv.csv) {
        console.log('User: ' + docs[0].user);
        console.log('User-Agent: ' + docs[0].userAgent);
        console.log('IP: ' + docs[0].ip);
        console.log('Date, Method, URL/Args');
        _.each(docs, function(d) {
          if (d.rpc) {
            console.log([d.created, d.rpc].join(',') + ',[' + d.args + ']');
          } else {
            console.log([d.created, d.method, d.url].join(','));
          }
        });
      }
      else {
        console.log(docs)
      }
      boots.error(err);
      process.exit(0);
    }
  );

});
