/*
 * note.js: Handling for the note resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <ObjectId>,
    "body": <String>,
    "beg": <Number>,
    "end": <Number>,
    "duration": <Number>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "parent_type": <String>,
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

  // Create
  app.post('/api/notes/:type', function (req, res) {
    if (!req.body.body || req.body.body === ''
        || !req.body.parent_id)
      return res.send(403, {error: 'Note invalid'});
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;

    // Get the note's parent.
    var resource_id = type === 'note' ?
        db.oid(props.parent_id): Number(props.parent_id);
    db[typeResource].read({_id: resource_id},
        {inflate: {author: profiles.user}}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // If this is a reply, get the original target.
          if (type === 'note')
            db[_.capitalize(parent.parent_type) + 's'].read(
                {_id: parent.parent_id}, {inflate: {author: profiles.user}}, this);
          else {
            props.parent_type = type;
            this();
          }
        },
        function (err, pparent) {
          if (com.error(err, req, res)) return;

          // Create the note.
          props.parent_id = parent._id;
          db.Notes.create(props, {inflate: {author: profiles.user}},
              function (err, doc) {
            if (com.error(err, req, res)) return;

            // Handle different types.
            var target = {
              t: type,
              i: parent.author._id.toString(),
              a: parent.author.displayName,
              u: parent.author.username
            };
            switch (type) {
              case 'dataset':
                target.n = parent.title;
                target.s = [parent.author.username, parent._id.toString()].join('/');
                break;
              case 'view':
                target.n = parent.name;
                target.s = [parent.author.username, 'views', parent.slug].join('/');
                break;
            }
            target.s += '#n=' + doc._id.toString();

            // Notify only if public.
            var notify = {};
            if (parent.public !== false) {
              notify = {subscriber: true};
            }

            // Publish comment.
            pubsub.publish('note', 'note.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: parent._id,
                action_id: doc._id,
                action_type: 'note',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'note',
                    b: _.prune(doc.body, 40)
                  },
                  target: target
                },
                public: parent.public !== false
              },
              options: {method: 'DEMAND_WATCH_SUBSCRIPTION'},
              notify: notify
            });

            // Subscribe actor to future events on this parent.
            pubsub.subscribe(req.user, parent, {style: 'watch', type: type});

            // Subscribe actor to future events on this note (replies).
            // Only support one level of replies.
            pubsub.subscribe(req.user, doc, {style: 'watch', type: 'note'});

            // Finish.
            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Read
  app.get('/api/notes/:id', function (req, res) {

    // Get the note.
    db.Notes.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'note')) return;

      // Fill note replies.
      db.fill(doc, 'Comments', 'parent_id', {sort: {created: -1}, limit: 5,
          inflate: {author: profiles.user}}, function (err) {
          if (com.error(err, req, res)) return;
          res.send(com.client(doc));
      });
    });
  });

  // Update (TODO)
  app.put('/api/notes/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/notes/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    // Delete the docs.
    function _delete(doc, type, cb) {
      Step(
        function () {

          // Remove notifications for events where note is action.
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

          // Remove events where doc is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the doc.
          db[type].remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          cb(err);

          // Publish removed status.
          if (!err) {
            pubsub.publish('note', 'note.removed', {data: {id: req.params.id}});
          }
        }
      );
    }

    Step(
      function () {
        var id = db.oid(req.params.id);

        // Get note and replies.
        db.Notes.read({_id: id, author_id: req.user._id}, this.parallel());
        db.Comments.list({parent_id: id}, this.parallel());
      },
      function (err, note, replies) {
        if (com.error(err, req, res, note, 'note')) return;
        var _this = _.after(1 + replies.length, this);
        _delete(note, 'Notes', _this);
        _.each(replies, function (r) {
          _delete(r, 'Comments', _this);
        });
      },
      function (err) {
        if (com.error(err, req, res)) return;
        res.send({removed: true});
      }
    );

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
