/*
 * channel.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var util = require('util');
var Step = require('step');
var _ = require('underscore');
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <ObjectId>,
    "beg": <Number>,
    "end": <Number>,
    "channelName": <String>,
    "humanName": <String>,
    "type": <String>,
    "merge": <Boolean>,
    "parent_id": <ObjectId>,
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
  var samples = app.get('samples');

  // Simply returns a JSON object about the channel
  app.get('/api/channels/:id', function (req, res) {

    // TODO: private/public - authenticate user.
    Step(
      function() {
        db.Channels.read({_id: db.oid(req.params.id)},
                         {inflate: {parent: profiles.dataset}}, this);
      },
      function(err, doc) {
        if (err) return this(err);
        channelDoc = doc;
        db.inflate(doc.parent, {author: profiles.user}, _.bind(function(err, d) {
          doc.parent = d;
          this(null, doc);
        }, this));
      },
      function(err, doc) {
        if (com.error(err, req, res, doc, 'channels')) return;
        res.send(com.client(doc));
      }
    );
  });

  // List
  app.post('/api/channels/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = req.body.query || {};

    db.Channels.list(query, {sort: {created: -1}, limit: limit,
                             skip: limit * cursor,
                             inflate: {dataset: profiles.dataset}
                     }, function (err, channels) {
      if (com.error(err, req, res)) return;
      if (channels.length === 0) return;
      // Send profile.
      res.send(com.client({
        channels: {
          cursor: ++cursor,
          more: channels && channels.length === limit,
          items: channels,
          query: query,
        }
      }));
    });

  });

  // Update (TODO)
  app.put('/api/channels/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: {message: 'User invalid'}});
    res.send();
  });

  // Delete
  app.delete('/api/channels/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: {message: 'User invalid'}});

    // Delete the channel.
    function _delete(doc, cb) {
      Step(
        function () {

          // Remove notifications for events where channel is action.
          db.Events.list({action_id: doc._id}, _.bind(function (err, events) {
            if (events.length === 0) return this();
            var _this = _.after(events.length, this);
            _.each(events, function (e) {

              // Publish removed status.
              pubsub.publish('event', 'event.removed', {data: e});

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('usr-' + note.subscriber_id.toString(),
                      'notification.removed', {data: {id: note._id.toString()}});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        }, function (err) {
          if (err) return this(err);

          // Remove events where channel is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Remove the channel from views that contain it.
          var key = 'datasets.' + doc.parent_id + '.channels.' + doc.channelName;
          var query = {};
          query[key] = {$exists: true};
          var update = {$unset: {}};
          update.$unset[key] = true;
          db.Views.update(query, update, {multi: true}, this.parallel());

          // Remove samples for this channel.
          samples.removeChannel(doc.channelName, this.parallel());

          // Finally, remove the channel.
          db.Channels.remove({_id: doc._id}, this.parallel());

          // Remove from search cache.
          // search.remove(doc._id, this.parallel());
        },
        function (err) {
          cb(err);

          // Publish removed status.
          if (!err) {
            pubsub.publish('channel', 'channel.removed', {data: {id: req.params.id}});
          }
        }
      );
    }

    Step(
      function () {
        var id = db.oid(req.params.id);

        // Get channel.
        db.Channels.read({_id: id, author_id: req.user._id}, this);
      },
      function (err, channel) {
        if (com.error(err, req, res, channel, 'channel')) return;
        _delete(channel, this);
      },
      function (err) {
        if (com.error(err, req, res)) return;
        res.send({removed: true});
      }
    );

  });

  // Search
  app.post('/api/channels/search/:s', function (req, res) {
    var author_id = req.body.author_id ? db.oid(req.body.author_id): null;

    Step(

      // Perform the search.
      function () {
        com.search(app.get('redis'), 'channels', req.params.s, 20, this);
      },

      function (err, ids) {
        if (err) return this(err);

        ids = _.map(ids, function(i) { return i.split('::')[1]; });

        // Check results.
        if (ids.length === 0) return this();

        // Map to ObjectIDs.
        var _ids = _.map(ids, function (id) {
          return db.oid(id);
        });

        // Get the matching datasets.
        var query = {_id: {$in: _ids}};
        if (author_id) {
          query.author_id = author_id;
        }
        db.Channels.list(query, {sort: {created: 1},
            inflate: {parent: profiles.dataset, author: profiles.user}}, this);
      },
      function (err, docs) {
        if (com.error(err, req, res)) return;
        docs = docs || [];

        Step(
          function () {
            if (docs.length === 0) return this();

            // Check access.
            var _this = _.after(docs.length, this);
            _.each(docs, function (d) {
              d.parent.author = d.author;
              com.hasAccess(req.user, d.parent, function (err, allow) {
                if (err) return _this(err);
                if (!allow) {
                  d.reject = true;
                }
                _this();
              });
            });
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Remove rejected.
            docs = _.reject(docs, function (d) {
              return d.reject;
            });

            // Send profile.
            res.send(com.client({items: docs || []}));
          }
        );
      }

    //   db.inflate(_.pluck(items, 'parent'), {author: profiles.user}, 
    //              _.bind(function(err, docs) {
    //     _.each(items, function(i, idx) {
    //       i.parent = docs[idx];
    //     }); 
    //     this(null, items);
    //   }, this));
    // },
    // function(err, items) {
    //   if (com.error(err, req, res)) return;
    //   res.send(com.client({ items: items || []}));
    // }
    );
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
