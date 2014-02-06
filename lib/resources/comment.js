/*
 * comment.js: Handling for the comment resource.
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
    "likes": <Number>,
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

  // List
  app.post('/api/comments/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.author_id) query.author_id = db.oid(req.body.author_id);
    if (req.body.parent_id) query.parent_id = Number(req.body.parent_id);

    db.Comments.list(query, {sort: {created: 1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.user}},
        function (err, comments) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        comments: {
          cursor: ++cursor,
          more: comments && comments.length === limit,
          items: comments
        }
      }));

    });

  });

  // Create
  app.post('/api/comments/:type', function (req, res) {
    if (!req.body.body || req.body.body === ''
        || !req.body.parent_id)
      return res.send(403, {error: 'Comment invalid'});
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;

    // Get the comment's parent.
    var resource_id = type === 'comment' ?
        db.oid(props.parent_id): Number(props.parent_id);
    db[typeResource].read({_id: resource_id},
        {inflate: {author: profiles.user}}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // If this is a reply, get the original target.
          if (type === 'comment')
            db[_.capitalize(parent.parent_type) + 's'].read(
                {_id: parent.parent_id}, {inflate: {author: profiles.user}}, this);
          else {
            props.parent_type = type;
            this();
          }
        },
        function (err, pparent) {
          if (com.error(err, req, res)) return;

          // Create the comment.
          props.parent_id = parent._id;
          db.Comments.create(props, {inflate: {author: profiles.user}},
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
                target.l = parent.public === false;
                break;
              case 'view':
                target.n = parent.name;
                target.s = [parent.author.username, 'views', parent.slug].join('/');
                target.l = parent.public === false;
                break;
              case 'comment':
                target.n = pparent.name || pparent.title;
                target.p = {
                  t: parent.parent_type,
                  i: pparent.author._id.toString(),
                  a: pparent.author.displayName,
                  u: pparent.author.username,
                  l: pparent.public === false
                };
                target.p.s = parent.parent_type === 'dataset' ?
                    [pparent.author.username, pparent._id.toString()].join('/'):
                    [pparent.author.username, 'views', pparent.slug].join('/');
            }

            // Notify subscribers of event.
            pubsub.notify({
              actor_id: req.user._id, 
              target_id: parent._id,
              action_id: doc._id, 
              data: {
                action: {
                  i: req.user._id.toString(),
                  a: req.user.displayName,
                  u: req.user.username,
                  g: req.user.gravatar,
                  t: 'comment',
                  b: doc.body
                },
                target: target
              }
            }, doc.body);

            // Subscribe actor to future events on this parent.
            pubsub.subscribe(req.user, parent, {style: 'watch', type: type});

            // Subscribe actor to future events on this comment (replies).
            // Only support one level of replies...
            if (type !== 'comment')
              pubsub.subscribe(req.user, doc, {style: 'watch', type: type});

            // Publish comment.
            pubsub.publish('comments', 'comment.new', doc);

            // Finish.
            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Read
  app.get('/api/comments/:id', function (req, res) {

    // Get the comment.
    db.Comments.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'comment')) return;

      // Fill comment replies.
      db.fill(doc, 'Comments', 'parent_id', {sort: {created: -1}, limit: 5,
          reverse: true, inflate: {author: profiles.user}}, function (err) {
          if (com.error(err, req, res)) return;
          res.send(com.client(doc));
      });
    });
  });

  // Update (TODO)
  app.put('/api/comments/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/comments/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    // Delete the comment.
    function _delete(doc, cb) {
      Step(
        function () {

          // Remove notifications for events where comment is action.
          db.Events.list({action_id: doc._id}, _.bind(function (err, events) {
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
        }, function (err) {
          if (err) return this(err);

          // Remove events where comment is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the comment.
          db.Comments.remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          cb(err);

          // Publish removed status.
          if (!err)
            pubsub.publish('comments', 'comment.removed', {id: doc._id});
        }
      );
    }

    Step(
      function () {
        var id = db.oid(req.params.id);

        // Get comment and replies.
        db.Comments.read({_id: id, author_id: req.user._id}, this.parallel());
        db.Comments.list({parent_id: id}, this.parallel());
      },
      function (err, comment, comments) {
        if (com.error(err, req, res, comment, 'comment')) return;
        comments.push(comment);
        var _this = _.after(comments.length, this);
        _.each(comments, function (com) {
          _delete(com, _this);
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
