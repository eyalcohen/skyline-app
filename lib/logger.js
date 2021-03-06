/*
 * logger.js - Log to Mongo
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var app = require('../app');

module.exports = {
  // Middleware for express
  requests: function(req, res, next) {
    // ignore server delivering files
    if (!req.url.split('.')[1]) {
      module.exports.write({
        user: req.user ? req.user.username : 'anon',
        url: req.url,
        ip: req.ip,
        method: req.method,
        userAgent: req.headers['user-agent']
      })
    }
    next();
  },

  // Log to mongo, no callback as we write and ignore the results using the
  // write concern
  write: function(obj) {
    sutil.removeEmptyStrings(obj);
    if (obj) {
      app.get('db').Logs.create(obj, {writeConcern: {w: 0}}, null);
    }
  }

}
