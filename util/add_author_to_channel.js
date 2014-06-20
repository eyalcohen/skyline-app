#!/usr/bin/env node
/*
 * wipe_db.js: Remove docs from all collectoins.
 * This is useful for clearing DB without having to re-index.
 *
 */
 
// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
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
 
boots.start(function (client) {

  Step(
    function () {
      db.Channels.list({}, {inflate: {parent: {collection: 'dataset', '*': 1}}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.author_id) return _this();
        db.Channels._update({_id: d._id}, {$set: {author_id: d.parent.author_id}}, _this);
      });
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
 
});
