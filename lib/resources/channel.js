/*
 * channel.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
var collections = require('skyline-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "author_id": <ObjectId>,
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
  var samples = app.get('samples');
  var cache = app.get('cache');

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
        if (errorHandler(err, req, res, doc, 'channels')) return;
        res.send(sutil.client(doc));
      }
    );
  });

  // List
  app.post('/api/channels/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = req.body.query || {};

    db.Channels.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {dataset: profiles.dataset}},
        function (err, channels) {
      if (errorHandler(err, req, res)) return;
      if (channels.length === 0) return;
      // Send profile.
      res.send(sutil.client({
        channels: {
          cursor: ++cursor,
          more: channels && channels.length === limit,
          items: channels,
          query: query,
        }
      }));
    });

  });

  // Update
  app.put('/api/channels/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Check details.
    var props = req.body;
    if (props.humanName && props.humanName.length === 1) {
      return res.send(403, {error: {message: 'Channel name too short'}});
    }

    // Skip if nothing to do.
    if (_.isEmpty(props)) {
      return res.send(403, {error: {message: 'Channel empty'}});
    }

    Step (
      function() {
        db.Channels.read({_id: db.oid(req.params.id)}, this);
      },
      function (err, doc) {
        if (errorHandler(err, req, res, doc, 'channel')) return;
        if (req.user._id.toString() !== doc.author_id.toString()) {
          return res.send(403, {error: {message: 'User invalid'}});
        }

        // TODO: Shouldn't set all props
        db.Channels.update({_id: doc._id}, {$set: props}, this.parallel());
        db.Datasets.update({_id: doc.parent_id}, {$set: {updated: new Date}},
            this.parallel());
      },
      // read updated document and index. Could also just index off updated
      // props but this way reflects accurately whats in the DB at the cost
      // of one more read. Too bad update doesn't return the doc
      function (err, stat) {
        if (errorHandler(err, req, res, stat, 'channel')) return;
        db.Channels.read({_id: db.oid(req.params.id)}, this);
      },
      function (err, doc) {
        if (errorHandler(err, req, res, doc, 'channel')) return;
        cache.index('channels', doc, ['humanName'], this);
      },
      function (err) {
        res.send({updated: true});
      }
    );
  });

  // Increment
  app.put('/api/channels/:id/inc', function (req, res) {
    if (req.params.id.length !== 24) {
      return res.send(403, {error: {message: 'Channel invalid'}});
    }
    db.Channels._update({_id: db.oid(req.params.id)}, {$inc: {vcnt: 1}},
        function (err) {
      if (errorHandler(err, req, res)) return;

      res.send();
    });
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
          db.Events.list({action_id: doc._id}, _.bind(function (err, es) {
            if (es.length === 0) return this();
            var _this = _.after(es.length, this);
            _.each(es, function (e) {

              // Publish removed status.
              events.publish('event', 'event.removed', {data: e});

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  events.publish('usr-' + note.subscriber_id.toString(),
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
            events.publish('channel', 'channel.removed', {data: {id: req.params.id}});
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
        if (errorHandler(err, req, res, channel, 'channel')) return;
        _delete(channel, this);
      },
      function (err) {
        if (errorHandler(err, req, res)) return;
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
        cache.search('channels', req.params.s, 250, this);
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
        // highest array element has highest vcnt
        db.Channels.list(query, {sort: {vcnt: 1, humanName: -1},
            inflate: {parent: profiles.dataset, author: profiles.user}}, this);
      },
      function (err, docs) {
        if (errorHandler(err, req, res)) return;
        docs = docs || [];

        Step(
          function () {
            if (docs.length === 0) return this();

            // Check access.
            var _this = _.after(docs.length, this);
            _.each(docs, function (d) {
              d.parent.author = d.author;
              hasAccess(db, req.user, d.parent, function (err, allow) {
                if (err) return _this(err);
                if (!allow) {
                  d.reject = true;
                }
                _this();
              });
            });
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Remove rejected.
            docs = _.reject(docs, function (d) {
              return d.reject;
            });

            // Send profile.  We only send first 50 results
            res.send(sutil.client({items: docs || []}));
          }
        );
      }
    );
  });

  return exports;
}
