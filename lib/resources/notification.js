/*
 * notification.js: Handling for the notification resource.
 *
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var authorize = require('./user').authorize;
var profiles = require('skyline-collections').profiles;
var app = require('../../app');

/* e.g.,

  subscription: {
    "_id": <ObjectId>,
    "meta": {
      "style": <String>, (watch || follow)
      "type": <String>, (dataset, view, user, etc.)
    },
    "mute": <Boolean>,
    "subscriber_id": <ObjectId>,
    "subscribee_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }

  notification: {
    "_id": <ObjectId>,
    "read": <Boolean>,
    "subscriber_id": <ObjectId>,
    "subscription_id": <ObjectId>,
    "event_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }

*/

// Init resource.
exports.init = function () {
  this.routes();
  return exports;
}

// Define routes for this resource.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // List
  app.post('/api/notifications/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.subscriber_id) {
      query.subscriber_id = db.oid(req.body.subscriber_id);
    }

    db.Notifications.list(query, {sort: {created: -1},
        limit: limit, skip: limit * cursor,
        inflate: {event: profiles.event}}, function (err, notifications) {
      if (errorHandler(err, req, res)) return;

      // Send profile.
      res.send(sutil.client({
        notifications: {
          cursor: ++cursor,
          more: notifications && notifications.length === limit,
          items: notifications
        }
      }));

    });
  });

  // Update as read
  app.put('/api/notifications/read/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    db.Notifications.update({_id: db.oid(req.params.id),
        subscriber_id: req.user._id},
        {$set: {read: true}}, function (err, stat) {
      if (errorHandler(err, req, res, stat, 'notification')) return;

      // Publish read status.
      events.publish('usr-' + req.user._id.toString(),
          'notification.read', {data: {id: req.params.id}});

      res.send({updated: true});
    });

  });

  // Delete
  app.delete('/api/notifications/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    db.Notifications.remove({_id: db.oid(req.params.id)}, function (err, stat) {
      if (errorHandler(err, req, res, stat, 'notification')) return;

      // Publish removed status.
      events.publish('usr-' + req.user._id.toString(),
          'notification.removed', {data: {id: req.params.id}});

      res.send({removed: true});
    });

  });

  return exports;
}
