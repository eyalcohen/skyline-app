#!/usr/bin/env node
/*
 * index.js: Index all users, datasets, views, and channels for search.
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

var datasetsIndexed = 0;
var channelsIndexed = 0;
var viewsIndexed = 0;
var usersIndexed = 0;

boots.start(function (client) {

  Step(
    function () {

      // Get all datasets.
      client.db.Datasets.list({}, this.parallel());
      client.cache.del('datasets-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        datasetsIndexed += client.cache.index('datasets', d, ['title', 'source', 'tags'],
            _this);
        datasetsIndexed += client.cache.index('datasets', d, ['title', 'source'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all views.
      client.db.Views.list({}, this.parallel());
      client.cache.del('views-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        viewsIndexed += client.cache.index('views', d, ['name', 'tags'], _this);
        viewsIndexed += client.cache.index('views', d, ['name'], {strategy: 'noTokens'},
            _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all users.
      client.db.Users.list({}, this.parallel());
      client.cache.del('users-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d, idx) {
        // Add new.
        usersIndexed += client.cache.index('users', d, ['displayName', 'username'],
            _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all channels.
      client.db.Channels.list({}, this.parallel());
      client.cache.del('channels-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d) {
        // Add new.
        channelsIndexed += client.cache.index('channels', d, ['humanName'], _this);
        channelsIndexed += client.cache.index('channels', d, ['humanName'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed users, datasets, views, and channels');
      util.log('Dataset entries: ' + datasetsIndexed);
      util.log('Channel entries: ' + channelsIndexed);
      util.log('View entries: ' + viewsIndexed);
      util.log('User entries: ' + usersIndexed);
      process.exit(0);
    }
  );

});
