/*
 * events.js: Handling for the event resource.
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
        "t": <String>, (action type: comment, note, dataset, follow, etc.)
        "b": <String>, (action message)
      },
      "target": {
        "a": <String>, (target user displayName)
        "n": <String>, (target title)
        "t": <String>, (target type: user, dataset, view, etc.)
        "s": <String>, (slug)
      }
    },
    "actor_id": <ObjectId>,
    "target_id": <ObjectId>,
    "action_id": <ObjectId>,
    "action_type": <String>,
    "public": <Boolean>,
    "date": <ISODate>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }

*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Build feed for user.
exports.feed = function (query, actions, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  var cursor = options.cursor || 0;
  delete options.cursor;
  options.limit = options.limit || 5;
  options.skip = cursor * options.limit;
  options.sort = {date: -1, created: -1};

  // Handle query.
  if (query.action) {
    _getEventsByAction(_.capitalize(query.action.type) + 's',
        query.action.query, _finish);
  } else {
    if (query.subscribee_id) {
      _getEventsBySubscription([query.subscribee_id], _finish);
    } else if (query.subscriber_id) {
      db.Subscriptions.list({$or: [
        {subscriber_id: query.subscriber_id, mute: false, 'meta.style': 'follow'},
        {subscriber_id: query.subscriber_id, mute: false, 'meta.style': 'watch'}
      ]}, function (err, subs) {
        if (err) return cb(err);

        // Consolidate subscribees.
        var subscribees = _.pluck(subs, 'subscribee_id');
        subscribees.push(query.subscriber_id);
        _getEventsBySubscription(subscribees, _finish);
      });
    } else cb(null, []);
  }

  function _finish(err, events) {
    if (err) return cb(err);
    cb(null, {
      cursor: ++cursor,
      more: events && events.length === options.limit,
      limit: options.limit,
      actions: actions,
      query: query,
      items: events || []
    });
  }

  // Get event by first finding actions by query.
  function _getEventsByAction(type, query, cb) {
    db[type].list(query, options, function (err, docs) {
      if (err) return cb(err);
      if (docs.length === 0) return cb();

      // Prepare events.
      var events = [];
      var _cb = _.after(docs.length, function (err) { cb(err, events); });
      _.each(docs, function (d) {

        // Get action's event.
        db.Events.read({action_id: d._id}, function (err, e) {

          if (err) return this(err);

          // Collect event.
          e.action = d;
          events.push(e);
          _prepareEventAction(e, _cb);
        });
      });
    });
  }

  // Get events related to subscriptions.
  function _getEventsBySubscription(subscribees, cb) {

    db.Events.list({
      action_type: {$in: actions},
      $or: [
        {actor_id: {$in: subscribees}},
        {target_id: {$in: subscribees}}
      ]
    }, options, function (err, events) {
      if (err) return cb(err);
      if (events.length === 0) return cb();

      // Prepare events.
      var _cb = _.after(events.length, function (err) { cb(err, events); });
      _.each(events, function (e) {

        // Inflate event action.
        db.inflate(e, {action: {collection: e.action_type, '*': 1}},
            function (err) {
          if (err) return _cb(err);

          // Prepare event.
          _prepareEventAction(e, _cb);
        });
      });
    });
  }

  // Inflate and fill an action.
  function _prepareEventAction(e, cb) {

    Step (
      function () {
        switch (e.action_type) {

          case 'dataset':
            db.inflate(e.action, {author: profiles.user}, this.parallel());
            db.fill(e.action, 'Channels', 'parent_id', {sort: {created: -1},
                limit: 5}, this.parallel());
            db.fill(e.action, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, inflate: {author: profiles.user}},
                this.parallel());
            db.fill(e.action, 'Notes', 'parent_id', {sort: {created: -1},
                limit: 5, inflate: {author: profiles.user}},
                this.parallel());
            break;

          case 'view':
            db.inflate(e.action, {author: profiles.user}, this.parallel());
            db.fill(e.action, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, inflate: {author: profiles.user}},
                this.parallel());
            db.fill(e.action, 'Notes', 'parent_id', {sort: {created: -1},
                limit: 5, inflate: {author: profiles.user}},
                this.parallel());
            break;

          case 'comment':
          case 'note':
            db.inflate(e.action, {author: profiles.user,
                parent: profiles[e.data.target.t]}, this);
            break;

          // case 'fork':
          //   break;
        }
      },
      function (err) {
        cb(err);
      }
    );
  }

}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // List
  app.post('/api/events/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = req.body.query || {};
    var actions = req.body.actions || ['dataset', 'view'];
    if (typeof query.subscribee_id === 'string')
      query.subscribee_id = db.oid(query.subscribee_id);
    if (typeof query.subscriber_id === 'string')
      query.subscriber_id = db.oid(query.subscriber_id);

    exports.feed(query, actions, {limit: limit, cursor: cursor, query: query},
        function (err, events) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({events: events}));
    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
