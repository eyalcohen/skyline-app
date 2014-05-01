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

      // Get all datasets.
      db.Datasets.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      _.each(docs, _.bind(function (d) {

        // Remove samples for this dataset.
        client.samples.removeDataset(d._id, this.parallel());
      }, this));
    },
    function (err) {
      boots.error(err);

      // db.Users.remove({}, this.parallel());
      db.Streams.remove({}, this.parallel());
      db.Producers.remove({}, this.parallel());
      db.Datasets.remove({}, this.parallel());
      db.Views.remove({}, this.parallel());
      db.Comments.remove({}, this.parallel());
      db.Keys.remove({}, this.parallel());
      db.Events.remove({}, this.parallel());
      db.Notifications.remove({}, this.parallel());
      db.Subscriptions.remove({}, this.parallel());
      db.Channels.remove({}, this.parallel());
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
