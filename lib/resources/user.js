/*
 * user.js: Handling for the user resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var url = require('url');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var db = require('../db');
var com = require('../common');
var search;

/* e.g.,
  {
    "_id" : <ObjectId>,
    "username": <String>,
    "password": <String>,
    "salt": <String>,
    "role": <Number>,
    "primaryEmail": <String>,
    "emails" : [
      {
        "value" : <String>
      }
    ],
    "displayName" : <String>,
    "name" : {
      "familyName" : <String>,
      "givenName" : <String>,
      "middleName" : <String>
    },
    "description" : <String>,
    "config" : <Object>,
    "provider": <String>,
    "googleId" : <String>,
    "facebook" : <String>,
    "facebookId" : <String>,
    "facebookToken" : <String>,
    "twitter": <String>,
    "twitterId" : <String>,
    "twitterToken" : <String>,
    "website": <String>,
    "created" : <ISODate>,
    "updated" : <ISODate>
  }
*/

var BLACKLIST = [
  'skyline',
  'data',
  'library',
  'streams',
  'stream',
  'public',
  'private',
  'contact',
  'about',
  'settings',
  'privacy',
  'terms',
  'reset',
  'logout',
  'service',
  'api',
  'user',
  'username',
  'chart',
  'embed',
  'clear'
];

var DEFUALT_CONFIG = {
  notifications: {
    comment: {
      email: true
    },
    note: {
      email: true
    },
    follow: {
      email: true
    },
    request: {
      email: true
    },
    accept: {
      email: true
    },
  },
  privacy: {
    mode: 0
  }
};

/*
 * Make salt for a password.
 */
function makeSalt() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}

/*
 * Index user for search.
 */
function indexUser(user) {
  com.index(search, user, ['displayName', 'username']);
}

// Do any initializations
exports.init = function (app) {
  search = app.get('reds').createSearch('users');

  // Create the skyline user to hold the the public library.
  // db.Users.create({
  //   provider: 'local',
  //   username: 'library',
  //   displayName: 'Library',
  //   role: 2
  // }, function (err, user) {
  //   if (err && err.code !== 11000) util.error(err);
  // });

  //
  // Passport auth/authz
  //

  // Serialize users for requests.
  passport.serializeUser(function (user, cb) {
    cb(null, user._id.toString());
  });

  // De-serialize users for requests.
  passport.deserializeUser(function (id, cb) {
    db.Users.read({_id: db.oid(id)}, function (err, user) {
      if (err) return cb(err);
      if (!user) return cb(null, null);
      delete user.password;
      delete user.salt;
      user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
      cb(null, user);
    });
  });

  // Facebook authenticate
  passport.use(new FacebookStrategy(app.get('facebook'),
      function (token, refresh, props, cb) {

    // Find existing user.
    props.primaryEmail = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    var query = {$or: [{facebookId: props.id}]};
    if (props.primaryEmail)
      query.$or.push({primaryEmail: props.primaryEmail});
    db.Users.read(query, function (err, user) {
      if (err) return cb(err);

      if (!user) {

        // Grab useful info from the profile.
        props.facebookToken = token;
        props.facebookRefresh = refresh;
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.facebookId = props.id;

        // Delete everything else.
        delete props.id;
        delete props.profileUrl;
        delete props._raw;
        delete props._json;

        // Setup new user object.
        _.defaults(props, {
          provider: 'facebook',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new user.
        db.Users.create(props, {force: {username: 1}},
            function (err, user) {
          if (err) return cb(err);

          // Index.
          indexUser(user);

          // Done.
          cb(null, user);
        });
        return;
      }

      // User exists. Update auth info.
      var update = {
        facebookId: props.id,
        facebookToken: token,
        facebookRefresh: refresh
      };
      db.Users.update({_id: user._id}, {$set: update}, function (err) {
        if (err) return cb(err);
        cb(null, _.extend(user, update));
      });
    });
  }));
  
  // Facebook authorize
  passport.use('facebook-authz', new FacebookStrategy(app.get('facebook'),
    function (token, refresh, profile, cb) {
      db.Users.read({facebookId: profile.id}, function (err, user) {
        if (err) return cb(err);
        cb(null, user, {
          facebookToken: token,
          facebookRefresh: refresh,
          facebookId: profile.id,
          facebook: profile.username,
        });
      });
    }
  ));
  
  // Twitter authenticate
  passport.use(new TwitterStrategy(app.get('twitter'),
      function (token, secret, props, cb) {

    // Find existing user.
    props.primaryEmail = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    var query = {$or: [{twitterId: props.id}]};
    if (props.primaryEmail)
      query.$or.push({primaryEmail: props.primaryEmail});
    db.Users.read(query, function (err, user) {
      if (err) return cb(err);
      
      if (!user) {

        // Grab useful info from the profile.
        props.twitterToken = token;
        props.twitterSecret = secret;
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.twitterId = props.id;

        // Delete everything else.
        delete props.id;
        delete props.profileUrl;
        delete props._raw;
        delete props._json;

        // Setup new user object.
        _.defaults(props, {
          provider: 'twitter',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new user.
        db.Users.create(props, {force: {username: 1}},
            function (err, user) {
          if (err) return cb(err);

          // Index.
          indexUser(user);

          // Done.
          cb(null, user);
        });
        return;
      }

      // User exists. Update auth info.
      var update = {
        twitterToken: token,
        twitterSecret: secret
      };
      db.Users.update({_id: user._id}, {$set: update}, function (err) {
        if (err) return cb(err);
        cb(null, _.extend(user, update));
      });
    });
  }));
  
  // Twitter authorize
  passport.use('twitter-authz', new TwitterStrategy(app.get('twitter'),
    function (token, secret, profile, cb) {
      db.Users.read({twitterId: profile.id}, function (err, user) {
        if (err) return cb(err);
        cb(null, user, {
          twitterToken: token,
          twitterSecret: secret,
          twitterId: profile.id,
          twitter: profile.username,
        });
      });
    }
  ));

  // Google authenticate
  passport.use(new GoogleStrategy(app.get('google'),
      function (id, props, cb) {
      
    // Find existing user.
    props.primaryEmail = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    var query = {$or: [{googleId: id}]};
    if (props.primaryEmail)
      query.$or.push({primaryEmail: props.primaryEmail});
    db.Users.read(query, function (err, user) {
      if (err) return cb(err);

      if (!user) {

        // Grab useful info from the profile.
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.googleId = id;

        // Setup new user object.
        _.defaults(props, {
          provider: 'google',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new user.
        db.Users.create(props, {force: {username: 1}}, function (err, user) {
          if (err) return cb(err);

          // Index.
          indexUser(user);

          cb(null, user);
        });
      } else {

        // User exists.
        cb(null, user);
      }
    });
  }));

  // Google authorize
  passport.use('google-authz', new GoogleStrategy(app.get('google'),
    function (id, props, cb) {
      db.Users.read({googleId: id}, function (err, user) {
        if (err) return cb(err);
        cb(null, user, {googleId: id});
      });
    }
  ));

  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');
  var samples = app.get('samples');
  var mailer = app.get('mailer');

  // Facebook authentication
  app.get('/auth/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook']._callbackURL = returnUrl;
    passport.authenticate('facebook', {scope: ['email',
        'publish_stream']})(req, res, next);
  });

  // Facebook returns here
  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', function (err, user, info) {
      if (err) return next(err);
      if (!user) return res.redirect('/');
      
      // Login.
      req.login(user, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next); 
  });

  // Facebook authorization
  app.get('/connect/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook-authz']._callbackURL = returnUrl;
    passport.authorize('facebook-authz', {scope: ['email',
        'publish_stream']})(req, res, next);
  });

  // Facebook authorization returns here
  app.get('/connect/facebook/callback', function (req, res, next) {
    passport.authorize('facebook-authz', function (err, user, info) {
      if (err) return next(err);
      if (!info) return res.redirect(req.session.referer || '/');
      db.Users.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Twitter authentication
  app.get('/auth/twitter', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/twitter/callback';
    var returnUrl = url.format(referer);
    passport._strategies['twitter']._oauth._authorize_callback = returnUrl;
    passport.authenticate('twitter')(req, res, next);
  });

  // Twitter authentication returns here
  app.get('/auth/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', function (err, user, info) {
      if (err) return next(err);
      if (!user) return res.redirect('/');
      
      // Login.
      req.login(user, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Twitter authorization
  app.get('/connect/twitter', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/twitter/callback';
    var returnUrl = url.format(referer);
    passport._strategies['twitter-authz']._oauth._authorize_callback = returnUrl;
    passport.authorize('twitter-authz')(req, res, next);
  });

  // Twitter authorization returns here
  app.get('/connect/twitter/callback', function (req, res, next) {
    passport.authorize('twitter-authz', function (err, user, info) {
      if (err) return next(err);
      if (!info) return res.redirect(req.session.referer || '/');
      db.Users.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Google authentication
  app.get('/auth/google', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/google/return';
    var returnUrl = url.format(referer);
    referer.pathname = '/';
    var realm = url.format(referer);    
    passport._strategies['google']._relyingParty.returnUrl = returnUrl;
    passport._strategies['google']._relyingParty.realm = realm;
    passport.authenticate('google')(req, res, next);
  });

  // Google authentication returns here
  app.get('/auth/google/return', function (req, res, next) {
    passport.authenticate('google', function (err, user, info) {
      if (err) return next(err);
      if (!user) return res.redirect('/');
      
      // Login.
      req.login(user, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Google authorization
  app.get('/connect/google', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/google/return';
    var returnUrl = url.format(referer);
    referer.pathname = '/';
    var realm = url.format(referer);    
    passport._strategies['google-authz']._relyingParty.returnUrl = returnUrl;
    passport._strategies['google-authz']._relyingParty.realm = realm;
    passport.authorize('google-authz')(req, res, next);
  });

  // Google authorization returns here
  app.get('/connect/google/return', function (req, res, next) {
    passport.authorize('google-authz', function (err, user, info) {
      if (err) return next(err);
      if (!info) return res.redirect(req.session.referer || '/');
      db.Users.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // List
  app.post('/api/users/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};
    var sort = req.body.sort || {created: -1};

    db.Users.list(query, {sort: sort, limit: limit,
        skip: limit * cursor},
        function (err, users) {
      if (com.error(err, req, res)) return;

      // Clean up.
      _.each(users, function (user) {
        delete user.password;
        delete user.salt;
        user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
      });

      // Send profile.
      res.send(com.client({
        profiles: {
          cursor: ++cursor,
          more: users && users.length === limit,
          items: users,
          query: query,
          sort: sort,
        }
      }));

    });
  });

  // Create
  app.post('/api/users', function (req, res) {
    if (!req.body || !req.body.newusername || !req.body.newemail
        || !req.body.newpassword) {
      return res.send(403, {error: 'User invalid'});
    }

    // Check details.
    req.body.newusername = _.slugify(req.body.newusername).substr(0, 30);
    if (req.body.newusername.length < 4) {
      return res.send(403, {error: 'Username too short'});
    }
    if (req.body.newpassword.length < 7) {
      return res.send(403, {error: 'Password too short'});
    }

    // Check blacklist.
    if (_.contains(BLACKLIST, req.body.newusername)) {
      return res.send(403, {error: 'Username exists'});
    }

    // Setup new user object.
    var props = {
      provider: 'local',
      username: req.body.newusername,
      displayName: req.body.newusername,
      emails: [{value: req.body.newemail}],
      primaryEmail: req.body.newemail,
      salt: makeSalt(),
      password: req.body.newpassword,
      config: DEFUALT_CONFIG,
      role: 1
    };

    // Handle password.
    props.password = com.encrypt(props.password, props.salt);

    // Attempt to create a new user.
    db.Users.create(props, function (err, user) {
      if (err && err.code === 11000) {
        if (err.err.indexOf('username') !== -1) {
          return res.send(403, {error: 'Username exists'});
        } else if (err.err.indexOf('primaryEmail') !== -1) {
          return res.send(403, {error: 'Email address exists'});
        } else {
          return res.send(403, {error: 'Unknown duplicate'});
        }
      }
      if (com.error(err, req, res)) return;

      // Index.
      indexUser(user);

      // Login.
      req.login(user, function (err) {
        if (com.error(err, req, res)) return;
        res.send({created: true});
      });
    });
  });

  // Read
  app.get('/api/users/:un', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un}, function (err, doc) {
      if (com.error(err, req, res, doc, 'user')) return;
      delete doc.password;
      delete doc.salt;
      delete doc.emails;
      delete doc.primaryEmail;
      delete doc.facebookToken;
      delete doc.facebookRefresh;
      delete doc.twitterToken;
      delete doc.twitterSecret;
      res.send(doc);
    });

  });

  // Update
  app.put('/api/users/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un) {
      return res.send(403, {error: 'User invalid'});
    }

    // Check details.
    var props = req.body;
    if (props.username) {
      props.username = _.slugify(props.username).substr(0, 30);
    }
    if (props.username !== undefined && props.username.length < 4) {
      return res.send(403, {error: 'Username too short'});
    }

    // Check blacklist.
    if (props.username && _.contains(BLACKLIST, props.username)) {
      return res.send(403, {error: 'Username exists'});
    }

    // Ensure displayName is not empty.
    if (props.displayName !== undefined && props.displayName.length < 4) {
      return res.send(403, {error: 'Name too short'});
    }

    // Skip if nothing to do.
    if (_.isEmpty(props)) {
      return res.send(403, {error: 'User empty'});
    }

    // Do the update.
    db.Users.update({_id: req.user._id}, {$set: props},
        function (err, stat) {
      if (err && err.code === 11001) {
        if (err.err.indexOf('username') !== -1) {
          return res.send(403, {error: 'Username exists'});
        } else if (err.err.indexOf('primaryEmail') !== -1) {
          return res.send(403, {error: 'Email address exists'});
        } else {
          return res.send(403, {error: 'Unknown duplicate'});
        }
      }
      if (com.error(err, req, res, stat, 'user')) return;

      Step(
        function () {

          // Get the user if needed.
          if (!props.username && !props.displayName) {
            return this();
          }
          db.Users.read({_id: req.user._id}, this);
        },
        function (err, user) {
          if (com.error(err, req, res)) return;

          // Index.
          if (user) {
            search.remove(user._id);
            indexUser(user);
          }

          res.send({updated: true});
        }
      );
    });
  });

  // Delete
  app.delete('/api/users/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'User invalid'});

    var uid = req.user._id;
    Step(
      function () {

        // Get user's own datasets, views, and events.
        db.Datasets.list({author_id: uid}, this.parallel());
        db.Views.list({author_id: uid}, this.parallel());
        db.Events.list({actor_id: uid}, this.parallel());
      },
      function (err, datasets, views, events) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Remove notifications for events where user's datasets are target.
            if (datasets.length === 0) return this();
            var next = _.after(datasets.length, this);
            _.each(datasets, function (d) {
              db.Events.list({target_id: d._id}, function (err, events) {
                if (events.length === 0) return next();
                var _next = _.after(events.length, next);
                _.each(events, function (e) {

                  // Publish removed status.
                  pubsub.publish('event', 'event.removed', {data: e});

                  db.Notifications.list({event_id: e._id},
                      function (err, notes) {

                    // Publish removed statuses.
                    _.each(notes, function (note) {
                      pubsub.publish('usr-' + note.subscriber_id.toString(),
                          'notification.removed', {data: {id: note._id.toString()}});
                    });
                  });
                  db.Notifications.remove({event_id: e._id}, _next);
                });
              });
            });
          },
          function () {

            // Remove notifications for events where user's views are target.
            if (views.length === 0) return this();
            var next = _.after(views.length, this);
            _.each(views, function (d) {
              db.Events.list({target_id: v._id}, function (err, events) {
                if (events.length === 0) return next();
                var _next = _.after(events.length, next);
                _.each(events, function (e) {

                  // Publish removed status.
                  pubsub.publish('event', 'event.removed', {data: e});

                  db.Notifications.list({event_id: e._id},
                      function (err, notes) {

                    // Publish removed statuses.
                    _.each(notes, function (note) {
                      pubsub.publish('usr-' + note.subscriber_id.toString(),
                          'notification.removed', {data: {id: note._id.toString()}});
                    });
                  });
                  db.Notifications.remove({event_id: e._id}, _next);
                });
              });
            });
          },
          function (err) {
            if (err) return this(err);
            var parallel = this.parallel;

            // Remove others' content on user's datasets.
            _.each(datasets, function (d) {

              // Publish removed status.
              pubsub.publish('dataset', 'dataset.removed', {data: {id: d._id.toString()}});

              // Remove samples for this dataset.
              samples.removeDataset(d._id, parallel());

              db.Notes.list({parent_id: d._id}, function (err, notes) {
                db.Notes.remove({parent_id: d._id}, this.parallel());
                db.Comments.remove({$or: [{parent_id: {$in: _.pluck(notes, '_id')}},
                    {parent_id: d._id}]}, this.parallel());
                db.Subscriptions.remove({subscribee_id: d._id}, parallel());
                db.Events.remove({target_id: d._id}, parallel());
              });
            });

            // Remove others' content on user's views.
            _.each(views, function (v) {

              // Publish removed status.
              pubsub.publish('view', 'view.removed', {data: {id: v._id.toString()}});

              db.Notes.list({parent_id: v._id}, function (err, notes) {
                db.Notes.remove({parent_id: v._id}, this.parallel());
                db.Comments.remove({$or: [{parent_id: {$in: _.pluck(notes, '_id')}},
                    {parent_id: v._id}]}, this.parallel());
                db.Subscriptions.remove({subscribee_id: v._id}, parallel());
                db.Events.remove({target_id: v._id}, parallel());
              });
            });

            // Remove user's content.
            db.Datasets.remove({author_id: uid}, parallel());
            db.Channels.remove({author_id: uid}, parallel());
            db.Views.remove({author_id: uid}, parallel());
            db.Notes.remove({author_id: uid}, parallel());
            db.Comments.remove({author_id: uid}, parallel());
            db.Subscriptions.remove({$or: [{subscriber_id: uid},
                {subscribee_id: uid}]}, parallel());
            _.each(events, function (e) {
              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('usr-' + note.subscriber_id.toString(),
                      'notification.removed', {data: {id: note._id.toString()}});
                });
              });
              db.Notifications.remove({event_id: e._id}, parallel());
            });
            db.Events.remove({actor_id: uid}, parallel());

            // Finally, remove the user.
            db.Users.remove({_id: uid}, parallel());

            // Remove from search cache.
            search.remove(uid, this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;
            
            // Logout.
            req.logout();
            delete req.session.referer;
            res.send({removed: true});
          }
        );
      }
    );
  });

  // Follow
  app.post('/api/users/:un/follow', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Find doc.
    db.Users.read({username: req.params.un}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      // Determine if a request is needed.
      var style = user.config.privacy.mode.toString() === '1' ?
        'request': 'follow';

      // Create subscription.
      pubsub.subscribe(req.user, user, {style: style, type: 'user'},
          function (err, sub) {
        if (com.error(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({following: style === 'follow' || style});
      });

    });

  });

  // Unfollow
  app.post('/api/users/:un/unfollow', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Find doc.
    db.Users.read({username: req.params.un}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      // Remove subscription.
      pubsub.unsubscribe(req.user, user, function (err, sub) {
        if (com.error(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({unfollowed: true});
      });

    });

  });

  // Accept
  app.put('/api/users/:sid/accept', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Users invalid'}});
    }

    // Find sub.
    db.Subscriptions.read({_id: db.oid(req.params.sid)}, function (err, sub) {
      if (com.error(err, req, res, sub, 'subscription')) return;

      // Update subscription.
      pubsub.accept(sub, function (err, sub) {
        if (com.error(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({followed: true});
      });

    });

  });

  // Auth
  app.post('/api/users/auth', function (req, res) {
    if (!req.body || !req.body.username || !req.body.password) {
      return res.send(403, {error: 'User invalid'});
    }

    // Find user.
    db.Users.read({$or: [{username: req.body.username},
          {primaryEmail: req.body.username}]}, function (err, user) {
      if (com.error(err, req, res)) return;

      // Check password.
      if (!user || !user.password
          || com.encrypt(req.body.password, user.salt) !== user.password) {
        return res.send(401, {error: 'Invalid credentials'});
      }

      // Login.
      req.login(user, function (err) {
        if (com.error(err, req, res)) return;
        res.send({authenticated: true});
      });

    });
  });

  // Forgot
  app.post('/api/users/forgot', function (req, res) {
    if (!req.body || !req.body.email) {
      return res.send(403, {error: 'User invalid'});
    }

    // Find user.
    db.Users.read({primaryEmail: req.body.email}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      if (!user.password) {
        return res.send(403, {error: 'No password',
            data: {provider: user.provider}});
      }

      // Send the email.
      mailer.reset(user, function (err) {
        if (com.error(err, req, res)) return;
        res.send({found: true});
      });

    });

  });

  // Reset
  app.post('/api/users/reset', function (req, res) {
    if (!req.body || !req.body.newpassword || !req.body.cnewpassword) {
      return res.send(403, {error: 'User invalid'});
    }

    // Check length
    if (req.body.newpassword.length < 7) {
      return res.send(403, {error: 'Password too short'});
    }

    // Compare new passwords.
    if (req.body.newpassword !== req.body.cnewpassword) {
      return res.send(403, {error: 'Passwords do not match'});
    }

    // Make new password.
    var props = {salt: makeSalt()};
    props.password = com.encrypt(req.body.newpassword, props.salt);

    // Check for user. 
    if (req.user) {

      // Get the user.
      db.Users.read({_id: req.user._id}, function (err, user) {
        if (com.error(err, req, res, user, 'user')) return;

        // Check old password.
        if (!user.password || !req.body.oldpassword
            || com.encrypt(req.body.oldpassword, user.salt) !== user.password) {
          return res.send(401, {error: 'Invalid credentials'});
        } else {
          update(user._id);
        }
      });
    
    // Check for session token.
    } else if (req.session.reset_token) {
      db.Keys.read({_id: db.oid(req.session.reset_token)}, function (err, key) {
        if (com.error(err, req, res, key, 'key')) return;
        delete req.session.reset_token;
        update(key.user_id);
      });
    } else {
      return res.send(403, {error: 'Password reset session invalid'});
    }

    // Do the update.
    function update(_id) {
      db.Users.update({_id: _id}, {$set: props},
          function (err, stat) {
        if (com.error(err, req, res, stat, 'user')) return;

        // All done.
        res.send({updated: true});
      });
    }
  });

  // Search
  app.post('/api/users/search/:s', function (req, res) {

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {
      Step(
        function () {

          // Check results.
          if (ids.length === 0) {
            return this();
          }

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching posts.
          db.Users.list({_id: {$in: _ids}}, {sort: {created: -1}}, this);
        },
        function (err, users) {
          if (com.error(err, req, res)) return;
          var filtered = [];
          _.each(users, function (u) {
            filtered.push({
              username: u.username,
              displayName: u.displayName,
              gravatar: com.hash(u.primaryEmail || 'foo@bar.baz'),
            });
          });

          // Send profile.
          res.send(com.client({items: filtered}));
        }
      );
    }, 'or');
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
