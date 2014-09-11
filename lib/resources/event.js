/*
 * event.js: Handling for the event resource.
 *
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var authorize = require('./user').authorize;
var collections = require('skyline-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../../app');

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

// Init resource.
exports.init = function () {
  this.routes();
  return exports;
}

// Build feed for user.
exports.feed = function (query, actions, options, cb) {
  var db = app.get('db');
  var events = app.get('events');

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  var cursor = options.cursor || 0;
  delete options.cursor;
  options.limit = options.limit || 5;
  options.skip = cursor * options.limit;
  options.sort = {date: -1, created: -1};
  var subscription;

  // Handle query.
  if (query.action) {
    _getEventsByAction(_.capitalize(query.action.type) + 's',
        query.action.query, _finish);
  } else {
    if (query.subscribee_id) {
      Step(
        function () {
          if (query.subscribee_type === 'user') {
            if (!query.user_id) {
              this();
            } else if (query.user_id.toString() === query.subscribee_id.toString()) {
              this(null, 'pass');
            } else {
              db.Subscriptions.read({subscriber_id: query.user_id,
                  subscribee_id: query.subscribee_id}, this);
            }
          }
        },
        function (err, sub) {
          if (err) return cb(err);
          if (sub !== 'pass') {
            if ((!sub || sub.meta.style !== 'follow' || sub.mute)
                && query.subscribee_privacy.toString() === '1') {
              return cb(null, {
                events: {items:[]},
                subscription: sub,
                private: true
              });
            } else {
              subscription = sub;
            }
          }
          _getEventsBySubscription([query.subscribee_id], _finish);
        }
      );
    } else if (query.subscriber_id) {
      db.Subscriptions.list({subscriber_id: query.subscriber_id, mute: false,
          $or: [{'meta.style': 'follow'}, {'meta.style': 'watch'}]},
      function (err, subs) {
        if (err) return cb(err);

        // Consolidate subscribees.
        var subscribees = _.pluck(subs, 'subscribee_id');
        _getEventsBySubscription(subscribees, _finish);
      });
    } else if (query.public) {
      _getPopularPublicEvents(_finish);
    } else {
      cb(null, {events: {items:[]}});
    }
  }

  function _finish(err, es) {
    if (err) return cb(err);
    var n = es ? es.length: 0;
    es = _.reject(es, function (e) {
      return e._reject;
    });
    cb(null, {
      events: {
        cursor: ++cursor,
        more: n === options.limit,
        limit: options.limit,
        actions: actions,
        query: query,
        items: es || []
      },
      subscription: subscription
    });
  }

  // Get event by first finding actions by query.
  function _getEventsByAction(type, query, cb) {
    db[type].list(query, options, function (err, docs) {
      if (err) return cb(err);
      if (docs.length === 0) return cb();

      // Prepare events.
      var es = [];
      var _cb = _.after(docs.length, function (err) { cb(err, es); });
      _.each(docs, function (d) {

        // Get action's event.
        db.Events.read({action_id: d._id}, function (err, e) {

          if (err) return this(err);

          // Collect event.
          e.action = d;
          es.push(e);
          events.inflate(e, query, _cb);
        });
      });
    });
  }

  // Get events related to subscriptions.
  function _getEventsBySubscription(subscribees, cb) {
    var eventQ = {
      action_type: {$in: actions},
      $or: [
        {actor_id: {$in: subscribees}, public: {$ne: false}},
        {target_id: {$in: subscribees}}
      ]
    };
    if (query.user_id) {
      if ((query.subscriber_id && 
          query.user_id.toString() === query.subscriber_id.toString())
          || (query.subscribee_id && 
          query.user_id.toString() === query.subscribee_id.toString())) {
        eventQ.$or.push({actor_id: query.user_id});
      }
    }
    db.Events.list(eventQ, options, function (err, es) {
      if (err) return cb(err);
      if (es.length === 0) return cb();

      // Prepare events.
      var _cb = _.after(es.length, function (err) { cb(err, es); });
      _.each(es, function (e) {

        // Inflate event action.
        db.inflate(e, {action: {collection: e.action_type, '*': 1}},
            function (err) {
          if (err) return _cb(err);

          // Prepare event.
          events.inflate(e, query, _cb);
        });
      });
    });
  }

  // Get public events.
  function _getPopularPublicEvents(cb) {
    Step(
      function () {
        db.Users.list({username: {$in: ['library', 'home']}}, this);
      },
      function (err, exclude) {
        if (err) return cb(err);
        var eventQ = {
          action_type: {$in: actions},
          public: {$ne: false},
          actor_id: {$nin: _.map(exclude, function (u) { return u._id; })}
        };
        options.sort = {vcnt: -1, created: -1};
        db.Events.list(eventQ, options, function (err, es) {
          if (err) return cb(err);
          if (es.length === 0) return cb();

          // Prepare events.
          var _cb = _.after(es.length, function (err) { cb(err, es); });
          _.each(es, function (e) {

            // Inflate event action.
            db.inflate(e, {action: {collection: e.action_type, '*': 1}},
                function (err) {
              if (err) return _cb(err);

              // Prepare event.
              events.inflate(e, query, _cb);
            });
          });
        });
      }
    );
  }
}

// Define routes for this resource.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');

  // List
  app.post('/api/events/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = req.body.query || {};
    var actions = req.body.actions || ['dataset', 'view'];
    if (typeof query.subscribee_id === 'string') {
      query.subscribee_id = db.oid(query.subscribee_id);
    }
    if (typeof query.subscriber_id === 'string') {
      query.subscriber_id = db.oid(query.subscriber_id);
    }
    if (req.user) {
      query.user_id = req.user._id;
    }

    exports.feed(query, actions, {limit: limit, cursor: cursor, query: query},
        function (err, feed) {
      if (errorHandler(err, req, res)) return;

      // Send profile.
      res.send(sutil.client({events: feed.events}));
    });
  });

  return exports;
}
