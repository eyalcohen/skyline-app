/*
 * dataset.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <Number>,
    "title": <String>,
    "file": {
      "size": <Number>,
      "type": <String>,
    },
    "meta": {
      "beg": <Number>,
      "end": <Number>,
      "channel_cnt": <Number>,
    },
    "client_id": <Number>,
    "author_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }
*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {

  // List
  app.post('/api/datasets/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);

    db.Datasets.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.user}},
        function (err, datasets) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        datasets: {
          cursor: ++cursor,
          more: datasets && datasets.length === limit,
          items: datasets,
          query: query,
        }
      }));

    });

  });

  // Create
  // (Currently handled by Client)
  app.post('/api/datasets', function (req, res) {
    
    // FIXME
    res.send({});
  });

  // Read
  app.get('/api/datasets/:id', function (req, res) {

    db.Datasets.read({key: req.params.id}, function (err, doc) {
      if (com.error(err, req, res, doc, 'dataset')) return;
      res.send(doc);
    });

  });

  // Update
  app.put('/api/datasets/:id', function (req, res) {

    // FIXME
    res.send();
  });

  // Delete
  app.delete('/api/datasets/:id', function (req, res) {

    // FIXME
    res.send();
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
