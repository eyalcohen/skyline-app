#!/usr/bin/env node
/*
 * index.js: Index all users, datasets, and views for search.
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
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var profiles = require('../lib/resources').profiles;

boots.start(function (client) {

  // Create searches.
  var searches = {
    users: reds.createSearch('users'),
    datasets: reds.createSearch('datasets'),
    views: reds.createSearch('views')
  };
  _.each(searches, function (s) { s.client = client.redisClient; });

  Step(
    function () {

      // Get all datasets.
      db.Datasets.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.datasets.remove(d._id, function (err) {
          boots.error(err);

          Step(
            function () {
              var skip = true;

              if (d.title && d.title !== '' && d.title.match(/\w+/g)) {
                skip = false;
                searches.datasets.index(d.title, d._id, this.parallel());
              }
              if (d.source && d.source !== '' && d.source.match(/\w+/g)) {
                skip = false;
                searches.datasets.index(d.source, d._id, this.parallel());
              }
              if (d.tags && d.tags.length > 0) {
                skip = false;
                _.each(d.tags, _.bind(function (t) {
                  if (t.match(/\w+/g)) searches.datasets.index(t, d._id, this.parallel());
                }, this));
              }
              if (d.file.name) {
                skip = false;
                var fileName = _.strLeft(d.file.name, '.');
                if (fileName !== '' && fileName.match(/\w+/g))
                  searches.datasets.index(fileName, d._id, this.parallel());
              }

              if (skip) this();
            },
            function (err) {
              boots.error(err);
              _this();
            }
          );

        });

      });
    },
    function (err) {
      boots.error(err);

      // Get all views.
      db.Views.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.views.remove(d._id, function (err) {
          boots.error(err);

          Step(
            function () {
              var skip = true;

              if (d.name && d.name !== '' && d.name.match(/\w+/g)) {
                skip = false;
                searches.views.index(d.name, d._id, this.parallel());
              }
              if (d.tags && d.tags.length > 0) {
                skip = false;
                _.each(d.tags, _.bind(function (t) {
                  if (t.match(/\w+/g)) searches.views.index(t, d._id, this.parallel());
                }, this));
              }

              if (skip) this();
            },
            function (err) {
              boots.error(err);
              _this();
            }
          );

        });

      });
    },
    function (err) {
      boots.error(err);

      // Get all users.
      db.Users.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.users.remove(d._id, function (err) {
          boots.error(err);

          Step(
            function () {
              var skip = true;

              if (d.displayName && d.displayName !== ''
                  && d.displayName.match(/\w+/g)) {
                skip = false;
                searches.users.index(d.displayName, d._id, this.parallel());
              }
              if (d.username.match(/\w+/g)) {
                skip = false;
                searches.users.index(d.username, d._id, this.parallel());
              }

              if (skip) this();
            },
            function (err) {
              boots.error(err);
              _this();
            }
          );

        });

      });
    },
    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
