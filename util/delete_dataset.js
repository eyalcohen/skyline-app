#!/usr/bin/env node
/*
 * delete_dataset.js: Remove a single dataset, its channels, and it's data.
 * Warning: Only use this when an event was not created for the dateset creation.
 * In that case, use can easily use the UI to delete the dataset.
 */
 
// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('id', 'Dataset Identifier')
      .demand('id')
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
      var did = Number(argv.id);
      db.Channels.remove({parent_id: did}, this.parallel());
      db.Datasets.read({_id: did}, this.parallel());
    }, function (err, doc) {
      boots.error(err);
      if (!doc) return this();

      if (doc.producer_id) {
        db.Producers.remove({_id: doc.producer_id}, this.parallel());
      }
      db.Datasets.remove({_id: doc._id}, this.parallel());
      client.samples.removeDataset(doc._id, this.parallel());
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
});
