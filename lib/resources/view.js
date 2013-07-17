/*
 * view.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db.js');
var com = require('../common.js');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <Number>,
    "name": <String>,
    "datasets": [
      {
        "_id": <Number>,
        "channels": [<String>],
      }
    ],
    "meta": {
      "beg": <Number>,
      "end": <Number>,
      "dataset_cnt": <Number>,
      "channel_cnt": <Number>,
    },
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
  app.post('/api/views/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);

    db.Views.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.user}},
        function (err, views) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        views: {
          cursor: ++cursor,
          more: views && views.length === limit,
          items: views,
          query: query,
        }
      }));

    });
  });

  // Create
  app.post('/api/views', function (req, res) {
    if (!req.user || !req.body || !req.body.name)
      return res.send(403, {error: 'View invalid'});

    // Setup new view object.
    var props = req.body;
    props._id = com.createId_32();
    props.slug = _.slugify(req.body.name);
    props.author_id = req.user._id;

    // Create the view.
    db.Views.create(props, {force: {_id: 1, slug: 1}},
        function (err, doc) {
      if (com.error(err, req, res)) return;
      res.send({created: true, slug: doc.slug});
    });
  });

  // Read
  app.get('/api/views/:id', function (req, res) {

    db.Views.read({key: req.params.id}, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;
      res.send(doc);
    });
  });

  // Update
  app.put('/api/views/:id', function (req, res) {

    // FIXME
    res.send();
  });

  // Delete
  app.delete('/api/views/:id', function (req, res) {

    // FIXME
    res.send();
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
