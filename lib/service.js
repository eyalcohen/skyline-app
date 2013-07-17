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

    // Write profile.
    var profile = {
      user: req.user,
      content: {page: null}
    };

    // Send profile.
    res.send(com.client(profile));
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

    // Get the user.
    db.Users.read({username: req.params.username}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {

          // Get datasets.
          db.Datasets.read({_id: Number(req.params.id), author_id: user._id},
              {inflate: {author: profiles.user}}, this.parallel());
          db.Datasets.list({_id: {$ne: Number(req.params.id)},
              author_id: user._id}, {inflate: {author: profiles.user},
              limit: 10, sort: {created: -1}}, this.parallel());
        },
        function (err, dataset, datasets) {
          if (com.error(err, req, res, dataset, 'dataset')) return;

          // Write profile.
          var profile = {
            user: req.user,
            content: {
              page: dataset,
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

  // View profile
  app.get('/service/view.profile/:username/:slug', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.username}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {

          // Get view.
          db.Views.read({slug: req.params.slug, author_id: user._id},
              {inflate: {author: profiles.user}}, req.user ? this.parallel(): this);
          if (req.user)
            db.Datasets.list({author_id: req.user._id},
                {inflate: {author: profiles.user}, limit: 10, 
                sort: {created: -1}}, this.parallel());
        },
        function (err, view, datasets) {
          if (com.error(err, req, res, view, 'view')) return;

          // Write profile.
          var profile = {
            user: req.user,
            content: {
              page: view,
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

  // User profile
  app.get('/service/user.profile/:username', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.username}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {

          // Get datasets.
          db.Datasets.list({author_id: user._id},
            {inflate: {author: profiles.user}, limit: 10, 
            sort: {created: -1}}, this.parallel());

          // Get views.
          db.Views.list({author_id: user._id},
            {inflate: {author: profiles.user}, limit: 10, 
            sort: {created: -1}}, this.parallel());
        },
        function (err, datasets, views) {
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
              },
              views: {
                cursor: 1,
                more: views && views.length === 10,
                items: views,
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

  // Dataset
  app.get('/:username/datasets/:id', function (req, res) {
    res.render('index', {user: req.user, wide: true});
  });

  // View
  app.get('/:username/views/:slug', function (req, res) {
    res.render('index', {user: req.user, wide: true});
  });

  // User profile
  app.get('/:username', function (req, res) {
    res.render('index', {user: req.user});
  });

}
