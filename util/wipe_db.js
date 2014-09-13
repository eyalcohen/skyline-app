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
 
boots.start(function (client) {
 
  Step(
    function () {
 
      // db.Users.remove({}, this.parallel());
      client.db.Streams.remove({}, this.parallel());
      client.db.Producers.remove({}, this.parallel());
      client.db.Datasets.remove({}, this.parallel());
      client.db.Views.remove({}, this.parallel());
      client.db.Comments.remove({}, this.parallel());
      client.db.Keys.remove({}, this.parallel());
      client.db.Events.remove({}, this.parallel());
      client.db.Notifications.remove({}, this.parallel());
      client.db.Subscriptions.remove({}, this.parallel());
      client.db.Channels.remove({}, this.parallel());
      client.db.Logs.remove({}, this.parallel());
 
      // Remove docs from real sample collections.
      _.each(client.samples.realCollections, _.bind(function (col) {
        col.remove({}, this.parallel());
      }, this));
 
      // Remove docs from synthetic sample collections.
      _.each(client.samples.syntheticCollections, _.bind(function (col) {
        col.remove({}, this.parallel());
      }, this));
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
 
});
