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
var db = require('../db');
var com = require('../common');

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
    "provider": <String>,
    "facebook" : <String>,
    "facebookId" : <String>,
    "facebookToken" : <String>,
    "location" : {
      "name" : <String>,
      "latitude" : <Number>,
      "longitude" : <Number>
    },
    "website": <String>,
    "created" : <ISODate>,
    "updated" : <ISODate>
  }
*/

var BLACKLIST = [
  'skyline',
  'data',
  'contact',
  'about',
  'settings',
  'privacy',
  'reset',
  'logout',
  'service',
  'api',
  'user',
  'username',
  'chart'
];

/*
 * Make salt for a password.
 */
function makeSalt() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}

// Do any initializations
exports.init = function (app) {

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

  // Google authenticate
  passport.use(new GoogleStrategy({returnURL: 'http://foo.bar', realm: null},
      function (id, props, cb) {
      
    // Find existing user.
    db.Users.read({googleId: id}, function (err, user) {
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
          config: {
            notifications: {
              comment: {
                email: true
              }
            }
          },
          role: 1
        });
        props.primaryEmail = props.emails.length > 0 ?
            props.emails[0].value: null;
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new user.
        return db.Users.create(props, {force: {username: 1}}, cb);
      }

      // User exists.
      cb(null, user);
    });
  }));

  return exports;
}

// Define routes.
exports.routes = function (app) {

  // Google Auth
  app.get('/auth/google', function (req, res, next) {

    // Add referer to session so we can use it on return.
    // This way we can preserve query params in links.
    req.session.referer = req.headers.referer;

    // Hack: fill in returnUrl and realm for google auth.
    var _url = url.parse(req.headers.referer);
    _url.search = _url.query = _url.hash = null;
    _url.pathname = '/auth/google/return';
    var returnUrl = url.format(_url);
    _url.pathname = '/';
    var realm = url.format(_url);
    passport._strategies['google']._relyingParty.returnUrl = returnUrl;
    passport._strategies['google']._relyingParty.realm = realm;
    passport.authenticate('google')(req, res, next);
  });

  // Google Auth callback
  app.get('/auth/google/return', function (req, res, next) {
    passport.authenticate('google', {
      successRedirect: req.session.referer || '/',
      failureRedirect: req.session.referer || '/'
    })(req, res, next);
  });

  // Create
  app.post('/api/users', function (req, res) {
    if (!req.body || !req.body.newusername || !req.body.newemail
        || !req.body.newpassword)
      return res.send(403, {error: 'User invalid'});

    // Check details.
    req.body.newusername = _.slugify(req.body.newusername).substr(0, 30);
    if (req.body.newusername.length < 4)
      return res.send(403, {error: 'Username too short'});
    if (req.body.newpassword.length < 7)
      return res.send(403, {error: 'Password too short'});

    // Check blacklist.
    if (_.contains(BLACKLIST, req.body.newusername))
      return res.send(403, {error: 'Username exists'});

    // Setup new member object.
    var props = {
      provider: 'local',
      username: req.body.newusername,
      displayName: req.body.newusername,
      emails: [{value: req.body.newemail}],
      primaryEmail: req.body.newemail,
      salt: makeSalt(),
      password: req.body.newpassword,
      config: {
        notifications: {
          comment: {
            email: true
          }
        }
      },
      role: 1
    };

    // Handle password.
    props.password = com.encrypt(props.password, props.salt);

    // Attempt to create a new user.
    db.Users.create(props, function (err, user) {
      if (err && err.code === 11000) {
        if (err.err.indexOf('username') !== -1)
          return res.send(403, {error: 'Username exists'});
        else if (err.err.indexOf('primaryEmail') !== -1)
          return res.send(403, {error: 'Email address exists'});
        else
          return res.send(403, {error: 'Unknown duplicate'});
      }
      if (com.error(err, req, res)) return;

      // Login.
      req.login(user, function (err) {
        if (com.error(err, req, res)) return;
        res.send({created: true});
      });
    });
  });

  // Read
  app.get('/api/users/:un', function (req, res) {
    
    // FIXME
    res.send();
  });

  // Update
  app.put('/api/users/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'User invalid'});

    // Do the update.
    db.Users.update({username: req.params.un}, {$set: req.body},
        function (err, stat) {
      if (err && err.code === 11001)
        return res.send(403, {error: 'Username exists'});
      if (com.error(err, req, res, stat, 'user')) return;
      res.send({updated: true});
    });
  });

  // Delete
  app.delete('/api/users/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'User invalid'});

    // FIXME
    res.send();
  });

  // Auth
  app.post('/api/users/auth', function (req, res) {
    if (!req.body || !req.body.username || !req.body.password)
      return res.send(403, {error: 'User invalid'});

    // Find user.
    db.Users.read({username: req.body.username}, function (err, user) {
      if (com.error(err, req, res)) return;

      // Check password.
      if (!user || !user.password
          || com.encrypt(req.body.password, user.salt) !== user.password)
        return res.send(401, {error: 'Bad credentials'});

      // Login.
      req.login(user, function (err) {
        if (com.error(err, req, res)) return;
        res.send({authenticated: true});
      });

    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
