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
var storage = require('../storage');

/* e.g.,
  {
    "_id": <Number>,
    "public": <Boolean>,
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
    "parent_id": <ObjectId>,
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

    // Handle author filter.
    if (query.author_id) query.author_id = db.oid(query.author_id);

    // Handle public/private.
    if (!query.author_id || !req.user
        || req.user._id.toString() !== query.author_id.toString())
      query.public = {$ne: false};

    db.Views.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.user}},
        function (err, views) {
      if (com.error(err, req, res)) return;


      Step(
        function () {
          return this();
          // if (views.length === 0) return this();

          // Get parent authors.
          // var _this = _.after(views.length, this);
          // _.each(views, function (d) {
          //   db.inflate(d.parent, {author: profiles.user}, _this);
          // });
        },
        function (err) {

          // Send profile.
          res.send(com.client({
            views: {
              cursor: ++cursor,
              more: views && views.length === limit,
              items: views,
              query: query,
            }
          }));
        }
      );

    });
  });

  // Create
  app.post('/api/views', function (req, res) {
    if (!req.user || !req.body || !req.body.name)
      return res.send(403, {error: {message: 'View invalid'}});

    // Setup new view object.
    var props = req.body;
    props._id = com.createId_32();
    props.slug = _.slugify(props.name);
    props.tags = com.tagify(props.tags);
    props.author_id = req.user._id;

    // Handle public.
    props.public = props.public === 'true' || props.public;

    Step(
      function () {
        if (!props.parent_id) return this();

        // Get fork parent.
        props.parent_id = Number(props.parent_id);
        db.Views.read({_id: props.parent_id},
            {inflate: {author: profiles.user}}, this);
      },
      function (err, parent) {
        if (com.error(err, req, res)) return;

        if (parent) {
          _.extend(props, {
            datasets: parent.datasets,
            time: parent.time
          });
        }
        com.removeEmptyStrings(props);

        var statcImgBuf;
        if (props.staticImg) {
          staticImgBuf = new Buffer(props.staticImg.split(',')[1], 'base64');
          delete props.staticImg;
        }

        // Create the view.
        db.Views.create(props, {force: {_id: 1, slug: 1},
            inflate: {author: profiles.user}}, function (err, doc) {
          if (com.error(err, req, res)) return;

          var where_ = 'snapshots-skyline';
          var key_ = 'views-' + doc._id;

          if (staticImgBuf) {
            var obj = {
              where: where_,
              key: key_,
              data: staticImgBuf,
              contentType: 'image/png',
              access: 'public-read'
            }
          }

          // store image URL
          var staticImgUrl = app.get('storage').urlGenerator(where_, key_);
          app.get('storage').store(obj, function(err) {
            if (!err) {
              db.Views.update({_id: doc._id}, 
                {$set: {staticImgUrl: staticImgUrl}}, function(err, doc) {});
            }
          });

          // Index for search.
          com.index(app.get('redis'), 'views', doc, ['name', 'tags'],
              function() {});
          com.index(app.get('redis'), 'views', doc, ['name'],
            {strategy: 'noTokens'}, function() {});

          // Add empty comments for client.
          doc.comments = [];
          doc.comments_cnt = 0;

          // Publish view.
          var event = {
            actor_id: req.user._id,
            target_id: parent ? parent._id: null,
            action_id: doc._id,
            action_type: 'view',
            data: {
              action: {
                i: req.user._id.toString(),
                a: req.user.displayName,
                u: req.user.username,
                g: req.user.gravatar,
                t: parent ? 'fork': 'view',
                n: doc.name,
                b: _.prune(doc.description, 40),
                s: [req.user.username, 'views', doc.slug].join('/')
              }
            },
            public: doc.public !== false
          }

          // If this is a fork, add the parent as event target.
          if (parent) {
            event.target_type = 'view';
            event.data.target = {
              i: parent.author._id.toString(),
              a: parent.author.displayName,
              u: parent.author.username,
              n: parent.name,
              s: [parent.author.username, 'views', parent.slug].join('/')
            };
          }

          // Publish dataset.
          pubsub.publish('view', 'view.new', {
            data: doc,
            event: event
          });

          // Subscribe actor to future events on parent.
          if (parent) {
            pubsub.subscribe(req.user, parent, {style: 'watch', type: 'view'});
          }

          // Subscribe actor to future events.
          pubsub.subscribe(req.user, doc, {style: 'watch', type: 'view'});

          // Finish.
          res.send(com.client(doc));
        });
      }
    );
  });

  // Read
  app.get('/api/views/:id', function (req, res) {

    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    db.Views.read(query,
                  {inflate: {author: profiles.user}}, function (err, doc) {

      if (com.error(err, req, res, doc, 'view')) return;

      if (!doc.public &&
          (!req.user || req.user._id.toString() !== doc.author._id.toString()))
        return res.send(403, {error: 'Could not authenticate user'});

      res.send(com.client(doc));
    });
  });

  // View static image
  app.get('/api/views/:id/img', function (req, res) {

    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    db.Views.read(query,
                  {inflate: {author: profiles.user}}, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;

      if (!doc.public &&
          (!req.user || req.user._id.toString() !== doc.author._id.toString()))
        return res.send(403, {error: 'Could not authenticate user'});

      app.get('storage').retrieve('snapshots-skyline', 'views-' + doc._id,
                                  function(err, data, contentType) {
        if (com.error(err, req, res, doc, 'view')) return;
        res.set('Content-Type', contentType);
        res.send(data);
      });
    });
  });

  // Update
  app.put('/api/views/:id', function (req, res) {
    if (!req.user || !req.body)
      return res.send(403, {error: {message: 'View invalid'}});

    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    // Get the view.
    db.Views.read(query, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: {message: 'User invalid'}});

      if (req.body.staticImg) {
        var obj = {
          where: 'snapshots-skyline',
          key: 'views-' + doc._id,
          data: new Buffer(req.body.staticImg.split(',')[1], 'base64'),
          contentType: 'image/png',
          access: 'public-read'
        }
        app.get('storage').store(obj);
        delete req.body.staticImg;
      }

      // Do the update.
      db.Views.update({_id: doc._id}, {$set: req.body},
          function (err, stat) {
        if (com.error(err, req, res, stat, 'view')) return;

        // All done.
        res.send({updated: true});
      });

    });
  });

  // Delete
  app.delete('/api/views/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: {message: 'User invalid'}});

    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    // Get the view.
    db.Views.read(query, function (err, doc) {
      if (com.error(err, req, res, doc, 'view')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: {message: 'User invalid'}});

      // Delete stored static image. No callback, as we can tolerate
      // this failing
      app.get('storage').delete('snapshots-skyline', 'views-' + doc._id);

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (com.error(err, req, res, event, 'event')) return;

        Step(
          function () {

            // Remove notifications for events where view is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
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
          },
          function (err) {
            if (err) return this(err);

            // Get notes on this view.
            db.Notes.list({parent_id: doc._id}, this);
          },
          function (err, notes) {
            if (err) return this(err);

            // Remove content on view.
            db.Notes.remove({parent_id: doc._id}, this.parallel());
            db.Comments.remove({$or: [{parent_id: {$in: _.pluck(notes, '_id')}},
                {parent_id: doc._id}]}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());

            // Finally, remove the view.
            db.Views.remove({_id: doc._id}, this.parallel());

            // Remove from search cache.
            // search.remove(doc._id, this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Publish removed status.
            pubsub.publish('event', 'event.removed', {data: event});
            pubsub.publish('view', 'view.removed', {data: {id: doc._id.toString()}});

            res.send({removed: true});
          }
        );
      });
    });

  });

  // Search
  app.post('/api/views/search/:s', function (req, res) {
    var author_id = req.body.author_id ? db.oid(req.body.author_id): null;

    Step(

      // Perform the search.
      function () {
        com.search(app.get('redis'), 'views', req.params.s, 20, this);
      },

      function (err, ids) {
        if (err) return this(err);

        ids = _.map(ids, function(i) { return i.split('::')[1]; });

        // Check results.
        if (ids.length === 0) return this();

        // Map to numeric ids.
        var _ids = _.map(ids, function (id) {
          return Number(id);
        });

        // Get the matching datasets.
        var query = {_id: {$in: _ids}, $or: [{public: {$ne: false}}]};
        if (req.user) {
          query.$or.push({author_id: req.user._id});
        }
        if (author_id) {
          query.author_id = author_id;
        }
        db.Views.list(query, {sort: {created: 1},
            inflate: {author: profiles.user}}, this);
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
              com.hasAccess(req.user, d, function (err, allow) {
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
    );
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
