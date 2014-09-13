#!/usr/bin/env node
/*
 * boots.js: Wrapper for utility operations.
 *
 */

// Module Dependencies
var redis = require('redis');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('mongish');
var Samples = require('skyline-samples-v1').Samples;
var Search = require('skyline-search').Search;
var collections = require('skyline-collections').collections;

var config = require('./config.json');
_.each(config, function (v, k) {
  config[k] = process.env[k] || v;
});

var error = exports.error = function(err) {
  if (!err) return;
  util.error(err.stack);
  process.exit(1);
}

exports.start = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  var props = {db: db};

  Step(
    function () {

      // Open DB connection.
      new db.Connection(config.MONGO_URI, {ensureIndexes: opts.index},
          this.parallel());

      // Init samples.
      props.samples = new Samples({
        mongoURI: config.MONGO_URI,
        cartodb: {
          user: config.CARTODB_USER,
          table: config.CARTODB_TABLE,
          key: config.CARTODB_KEY
        },
        indexDb: opts.index
      }, this.parallel());

      // Init search cache.
      if (config.REDIS_PORT && config.REDIS_HOST_CACHE) {
        props.cache = new Search({
          redisHost: config.REDIS_HOST_CACHE,
          redisPort: config.REDIS_PORT
        }, this.parallel());
      }
    },
    function (err, connection) {

      // Init collections.
      if (_.size(collections) === 0) {
        return this();
      }
      _.each(collections, _.bind(function (c, name) {
        connection.add(name, c, this.parallel());
      }, this));
    },
    function (err) {
      error(err);
      cb(props);
    }
  );
}
