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
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <Number>,
    "name": <String>,
    "slug": <String>,
    "datasets": {
      <Number>: {
        channels: {
          <String>: <Channel>,
        },
        index: <Number>
      },
    },
    "time": {
      "beg": <Number>,
      "end": <Number>
    },
    "author_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

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
    db.Views.create(props, {force: {_id: 1, slug: 1},
        inflate: {author: profiles.user}},
        function (err, doc) {
      if (com.error(err, req, res)) return;
      res.send(com.client(doc));

      // Publish new view.
      pubsub.publish('views', 'view.new', com.client(doc));

      // Inc author view count.
      db.Users._update({_id: req.user._id}, {$inc: {vcnt: 1}},
          function (err) { if (err) util.error(err); });
    });
  });

  // Read
  app.get('/api/views/:id', function (req, res) {

    // TODO: private/public - authenticate user.
    db.Views.read({_id: Number(req.params.id)},
        {inflate: {author: profiles.user}}, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;
      res.send(com.client(doc));
    });
  });

  // Update
  app.put('/api/views/:id', function (req, res) {

    // FIXME
    res.send();
  });

  // Delete
  app.delete('/api/views/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the view.
    db.Views.read({_id: Number(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'Member invalid'});

      Step(
        function () {

          // Remove notifications for events where view is target.
          db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
            if (events.length === 0) return this();
            var _this = _.after(events.length, this);
            _.each(events, function (e) {

              // Publish removed status.
              pubsub.publish('events', 'event.removed', e);

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('usr-' + note.subscriber_id.toString(),
                      'notification.removed', {id: note._id.toString()});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        },
        function (err) {
          if (err) return this(err);

          // Remove content on view.
          db.Comments.remove({parent_id: doc._id}, this.parallel());
          db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
          db.Events.remove({target_id: doc._id}, this.parallel());

          // Finally, remove the view.
          db.Views.remove({_id: doc._id}, this.parallel());

          // De-inc author view count.
          db.Users._update({_id: doc.author_id}, {$inc: {vcnt: -1}}, this.parallel());

        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('views', 'view.removed', {id: doc._id.toString()});

          res.send({removed: true});
        }
      );

    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
