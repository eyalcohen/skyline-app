/*
 * comment.js: Handling for the comment resource.
 *
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('skyline-collections').profiles;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "body": <String>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "parent_type": <String>,
    "created": <ISODate>,
    "updated": <ISODate>
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
  app.post('/api/comments/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var skip = req.body.skip || cursor * limit;
    var query = {};

    if (req.body.author_id) {
      query.author_id = db.oid(req.body.author_id);
    }
    if (req.body.parent_id) {
      query.parent_id = req.body.type ?
          Number(req.body.parent_id): db.oid(req.body.parent_id);
    }

    db.Comments.list(query, {sort: {created: -1}, limit: limit,
        skip: skip, inflate: {author: profiles.user}},
        function (err, comments) {
      if (errorHandler(err, req, res)) return;

      // Send profile.
      res.send(sutil.client({
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
        || !req.body.parent_id) {
      return res.send(403, {error: {message: 'Comment invalid'}});
    }
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;

    // Get the comment's parent.
    var resource_id = type === 'note' ?
        db.oid(props.parent_id): Number(props.parent_id);
    db[typeResource].read({_id: resource_id},
        {inflate: {author: profiles.user}}, function (err, parent) {
      if (errorHandler(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // If this is a reply, get the original target.
          if (type === 'note') {
            db[_.capitalize(parent.parent_type) + 's'].read(
                {_id: parent.parent_id}, {inflate: {author: profiles.user}}, this);
          } else {
            props.parent_type = type;
            this();
          }
        },
        function (err, pparent) {
          if (errorHandler(err, req, res)) return;

          // Create the comment.
          props.parent_id = parent._id;
          db.Comments.create(props, {inflate: {author: profiles.user}},
              function (err, doc) {
            if (errorHandler(err, req, res)) return;

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
              case 'note':
                target.p = {
                  t: parent.parent_type,
                  i: pparent.author._id.toString(),
                  a: pparent.author.displayName,
                  u: pparent.author.username,
                  n: pparent.name || pparent.title,
                  s: parent.parent_type === 'dataset' ?
                      [pparent.author.username, pparent._id.toString()].join('/'):
                      [pparent.author.username, 'views', pparent.slug].join('/')
                };
                target.p.s += '/note/' + parent._id.toString() + '#c=' + doc._id.toString();
            }
            target.s += '#c=' + doc._id.toString();

            // Notify only if public.
            var notify = {};
            if (type === 'note') {
              if (pparent.public !== false) {
                notify = {subscriber: true};
              }
            } else if (parent.public !== false) {
              notify = {subscriber: true};
            }

            // Publish comment.
            events.publish('comment', 'comment.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: parent._id,
                action_id: doc._id,
                action_type: 'comment',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'comment',
                    b: _.prune(doc.body, 40)
                  },
                  target: target
                },
                public: type === 'note' ? pparent.public !== false:
                    parent.public !== false
              },
              options: {method: 'DEMAND_WATCH_SUBSCRIPTION'},
              notify: notify
            });

            // Subscribe actor to future events on this parent.
            events.subscribe(req.user, parent, {style: 'watch', type: type});

            // Finish.
            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Update (TODO)
  app.put('/api/comments/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }
    res.send();
  });

  // Delete
  app.delete('/api/comments/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Delete the comment.
    function _delete(doc, cb) {
      Step(
        function () {

          // Remove notifications for events where comment is action.
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

          // Remove events where comment is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the comment.
          db.Comments.remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          cb(err);

          // Publish removed status.
          if (!err) {
            events.publish('commment', 'comment.removed', {data: {id: req.params.id}});
          }
        }
      );
    }

    Step(
      function () {
        var id = db.oid(req.params.id);

        // Get comment.
        db.Comments.read({_id: id, author_id: req.user._id}, this);
      },
      function (err, comment) {
        if (errorHandler(err, req, res, comment, 'comment')) return;
        _delete(comment, this);
      },
      function (err) {
        if (errorHandler(err, req, res)) return;
        res.send({removed: true});
      }
    );

  });

  return exports;
}
