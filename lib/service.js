/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common.js');
var profiles = require('./resources').profiles;

// Define routes.
exports.routes = function (app) {

  //
  // JSON page profiles.
  //

  // Home profile
  app.get('/service/home.profile', function (req, res) {

    Step(
      function () {

        // Get datasets.
        db.Datasets.list({}, {sort: {created: -1}, limit: 10,
            inflate: {author: profiles.user}}, this);

      },
      function (err, posts, datasets) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: {
            datasets: {
              cursor: 1,
              more: datasets && datasets.length === 10,
              items: datasets
            }
          }
        };

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Static profile
  app.get('/service/static.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));

    // Send profile.
    res.send(com.client({
      user: req.user,
      content: {page: null},
    }));

  });

  // Dataset profile
  app.get('/service/dataset.profile/:username/:id', function (req, res) {

    Step(
      function () {

        // Get dataset.
        db.Datasets.read({_id: Number(req.params.id)},
            {inflate: {author: profiles.user}}, this);

      },
      function (err, dataset) {
        if (com.error(err, req, res, dataset, 'dataset')) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: {page: dataset}
        };

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // User profile
  app.get('/service/user.profile/:un', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {

          // Get datasets.
          db.Datasets.list({author_id: user._id}, {sort: {created: -1}, limit: 10,
              inflate: {author: profiles.user}}, this);

        },
        function (err, datasets) {
          if (com.error(err, req, res)) return;

          // Write profile.
          delete user.password;
          delete user.salt;
          user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
          var profile = {
            user: req.user,
            content: {
              page: user,
              datasets: {
                cursor: 1,
                more: datasets && datasets.length === 10,
                items: datasets,
                query: {author_id: user._id}
              }
            }
          };

          // Send profile.
          res.send(com.client(profile));

        }
      );
    });

  });

  // Settings profile
  app.get('/service/settings.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));

    // Send profile.
    res.send(com.client({
      user: req.user,
      content: {page: req.user},
    }));

  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', function (req, res) {
    res.render('index', {user: req.user});
  });

  // Setings
  app.get('/settings', function (req, res) {
    if (!req.user) return res.redirect('/');
    res.render('index', {user: req.user});
  });

  // Logout
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // Post
  app.get('/:username/:id', function (req, res) {
    res.render('index', {user: req.user});
  });  

  // User profile
  app.get('/:username', function (req, res) {
    res.render('index', {user: req.user});
  });

}
