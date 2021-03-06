/*
 * view.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var util = require('util');
var sutil = require('skyline-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var collections = require('skyline-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../../app');

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
  var cache = app.get('cache');
  var storage = app.get('storage');

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
      if (errorHandler(err, req, res)) return;


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
          res.send(sutil.client({
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
    props._id = sutil.createId_32();
    props.slug = _.slugify(props.name);
    props.tags = sutil.tagify(props.tags);
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
        if (errorHandler(err, req, res)) return;

        if (parent) {
          _.extend(props, {
            datasets: parent.datasets,
            time: parent.time
          });
        }
        sutil.removeEmptyStrings(props);

        var statcImgBuf;
        if (props.staticImg) {
          staticImgBuf = new Buffer(props.staticImg.split(',')[1], 'base64');
          delete props.staticImg;
        }

        // Create the view.
        db.Views.create(props, {force: {_id: 1, slug: 1},
            inflate: {author: profiles.user}}, function (err, doc) {
          if (errorHandler(err, req, res)) return;

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
          var staticImgUrl = storage.urlGenerator(where_, key_);
          storage.store(obj, function(err) {
            if (!err) {
              db.Views.update({_id: doc._id}, 
                {$set: {staticImgUrl: staticImgUrl}}, function(err, doc) {});
            }
          });

          // Index for search.
          cache.index('views', doc, ['name', 'tags'], function() {});
          cache.index('views', doc, ['name'], {strategy: 'noTokens'}, function() {});

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
          events.publish('view', 'view.new', {
            data: doc,
            event: event
          });

          // Subscribe actor to future events on parent.
          if (parent) {
            events.subscribe(req.user, parent, {style: 'watch', type: 'view'});
          }

          // Subscribe actor to future events.
          events.subscribe(req.user, doc, {style: 'watch', type: 'view'});

          // Finish.
          res.send(sutil.client(doc));
        });
      }
    );
  });

  // Read
  app.get('/api/views/:id', function (req, res) {
    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    db.Views.read(query, {inflate: {author: profiles.user}},
        function (err, doc) {
      if (errorHandler(err, req, res, doc, 'view')) return;

      // Check access.
      hasAccess(db, req.user, doc, function (err, allow) {
        if (errorHandler(err, req, res)) return;
        if (!allow) {
          return errorHandler(null, req, res, undefined, 'view');
        }

        res.send(sutil.client(doc));
      });
    });
  });

  // Update
  app.put('/api/views/:id', function (req, res) {
    if (!req.user || !req.body) {
      return res.send(403, {error: {message: 'View invalid'}});
    }
    var props = req.body;
    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    if (props.tags) {
      props.tags = sutil.tagify(props.tags);
    }

    // Skip if nothing to do.
    if (_.isEmpty(props)) {
      return res.send(403, {error: {message: 'Dataset empty'}});
    }

    // Get the view.
    db.Views.read(query, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'view')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: {message: 'User invalid'}});
      }

      // Check for updated static image.
      if (props.staticImg) {
        var obj = {
          where: 'snapshots-skyline',
          key: 'views-' + doc._id,
          data: new Buffer(props.staticImg.split(',')[1], 'base64'),
          contentType: 'image/png',
          access: 'public-read'
        }
        storage.store(obj);
        delete props.staticImg;
      }

      // Do the update.
      db.Views.update({_id: doc._id}, {$set: props}, function (err, stat) {
        if (errorHandler(err, req, res, stat, 'view')) return;

        Step(
          function () {

            // If needed, update event privacy.
            if (props.public !== undefined) {
              db.Events.update({action_id: doc._id}, {$set: {public: props.public}},
                  _.bind(function (err, stat) {
                if (errorHandler(err, req, res, stat, 'event')) return;
                this();
              }, this));
            } else {
              this();
            }
          },
          function () {

            // All done.
            res.send({updated: true});
          }
        );
      });

    });
  });

  // Delete
  app.delete('/api/views/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    var idMaybe = Number(req.params.id);
    var query = _.isNaN(idMaybe) ? {slug: req.params.id} : {_id: idMaybe};

    // Get the view.
    db.Views.read(query, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'view')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: {message: 'User invalid'}});

      // Delete stored static image. No callback, as we can tolerate
      // this failing
      storage.delete('snapshots-skyline', 'views-' + doc._id);

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (errorHandler(err, req, res, event, 'event')) return;

        Step(
          function () {

            // Remove notifications for events where view is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, es) {
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
            if (errorHandler(err, req, res)) return;

            // Publish removed status.
            events.publish('event', 'event.removed', {data: event});
            events.publish('view', 'view.removed', {data: {id: doc._id.toString()}});

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
        cache.search('views', req.params.s, 20, this);
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
        // highest array element has highest vcnt
        db.Views.list(query, {sort: {vcnt: 1, name: -1},
            inflate: {author: profiles.user}}, this);
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
              hasAccess(db, req.user, d, function (err, allow) {
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

            // Send profile.
            res.send(sutil.client({items: docs || []}));
          }
        );
      }
    );
  });

  // Watch
  app.post('/api/views/:id/watch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Find doc.
    db.Views.read({_id: Number(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'view')) return;

      // Check access.
      hasAccess(db, req.user, doc, function (err, allow) {
        if (errorHandler(err, req, res)) return;
        if (!allow) {
          return errorHandler(null, req, res, undefined, 'view');
        }

        // Create subscription.
        events.subscribe(req.user, doc, {style: 'watch', type: 'view'},
            function (err, sub) {
          if (errorHandler(err, req, res, sub, 'subscription')) return;

          // Send status.
          res.send({watching: true});
        });
      });
    });

  });

  // Unwatch
  app.post('/api/views/:id/unwatch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Find doc.
    db.Views.read({_id: Number(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'view')) return;

      // Check access.
      hasAccess(db, req.user, doc, function (err, allow) {
        if (errorHandler(err, req, res)) return;
        if (!allow) {
          return errorHandler(null, req, res, undefined, 'view');
        }

        // Remove subscription.
        events.unsubscribe(req.user, doc, function (err, sub) {
          if (errorHandler(err, req, res, sub, 'subscription')) return;

          // Send status.
          res.send({unwatched: true});
        });
      });
    });

  });

  return exports;
}
