/*
 * event.js: Handling for the event resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var authorize = require('./user').authorize;
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,

  event: {
    "_id": <ObjectId>,
    "data": {
      "action": {
        "a": <String>, (actor user displayName)
        "g": <String>, (actor md5 email hash)
        "t": <String>, (action type: comment, star, follow, etc.)
        "b": <String>, (action message)
      },
      "target": {
        "a": <String>, (target user displayName)
        "n": <String>, (target title)
        "t": <String>, (target type: dataset, view, etc.)
        "s": <String>, (slug)
      }
    },
    "public": <Boolean>,
    "actor_id": <ObjectId>,
    "target_id": <ObjectId>,
    "action_id": <ObjectId>,
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
  var pubsub = app.get('pubsub');

  // List
  app.post('/api/events/list', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    function listEvents(cb) {

      Step(
        function () {

          // Get events where actor is user.
          db.Events.list({actor_id: req.user._id}, {sort: {created: -1},
              limit: limit, skip: limit * cursor}, this.parallel());

          // Get following.
          db.Subscriptions.list({subscriber_id: req.user._id, mute: false,
              'meta.style': 'follow'}, this.parallel());

        },
        function (err, events, subs) {
          if (err) return cb(err);
          if (subs.length === 0) return cb(null, events);

          Step(
            function () {
              
              var _this = _.after(subs.length, this);
              _.each(subs, function (s) {

                // Get events where actor is subscribee.
                db.Events.list({actor_id: s.subscribee_id, public: {$ne: false}},
                    {sort: {created: -1}, limit: limit, skip: limit * cursor},
                    _.bind(function (err, docs) {
                  if (err) return this(err);

                  // Gather events.
                  events.push.apply(events, docs);
                  _this();
                }, this));
              });
            },
            function (err) {
              if (err) return cb(err);

              // Sort events.
              cb(null, events.sort(function (a, b) {
                return b.created - a.created;
              }));
            }
          );
        }
      );
    }

    // List events for this user.
    listEvents(function (err, events) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        events: {
          cursor: ++cursor,
          more: events.length !== 0,
          items: events
        }
      }));
    });
  });

  // Update
  app.put('/api/events/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/events/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    db.Events.delete({_id: db.oid(req.params.id),
        actor_id: req.user._id}, function (err, stat) {
      if (com.error(err, req, res, stat, 'event')) return;

      // Publish removed status.
      pubsub.publish('usr-' + req.user._id.toString(),
          'event.removed', {id: req.params.id});

      res.send({removed: true});
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
