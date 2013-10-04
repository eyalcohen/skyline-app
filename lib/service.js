/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var url = require('url');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;

// Define routes.
exports.routes = function (app) {

  /*
   * HTTP request handler.
   */
  function handler(sfn, req, res) {

    // Handle the request statically if the user-agent
    // is from Facebook's url scraper or if specifically requested.
    var parts = url.parse(req.url, true);
    if (parts.query['static'] === 'true' || (req.headers
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1))
      return sfn(req, res);

    // Handle the request normally.
    res.render('index', {
      user: req.user,
      root: app.get('ROOT_URI')
    });
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));

    if (req.query.n === '0')
      return res.send(com.client({
        user: req.user,
        content: {page: null}
      }));

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        user: req.user,
        content: {page: null},
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

  });

  // Home profile
  app.get('/service/home.profile', function (req, res) {
    res.redirect('/service/static.profile');
  });

  // Dataset profile
  app.get('/service/chart.profile', function (req, res) {
    var parts = url.parse(req.url, true);
    var state = parts.query['state'];
    if (!state)
      return res.redirect('/service/static.profile');
    state = JSON.parse(state);

    // // Get the user.
    // db.Users.read({username: req.params.un}, function (err, user) {
    //   if (com.error(err, req, res, user, 'user')) return;

    //   Step(
    //     function () {

    //       // Get datasets.
    //       db.Datasets.read({_id: Number(req.params.id), author_id: user._id},
    //           {inc: true, inflate: {author: profiles.user}}, this.parallel());
    //       db.Datasets.list({_id: {$ne: Number(req.params.id)},
    //           author_id: user._id}, {inflate: {author: profiles.user},
    //           limit: 9, sort: {created: -1}}, this.parallel());
    //       if (req.user && req.query.n !== '0')
    //         db.Notifications.list({subscriber_id: req.user._id},
    //             {sort: {created: -1}, limit: 5,
    //             inflate: {event: profiles.event}}, this.parallel());
    //     },
    //     function (err, dataset, datasets, notes) {
    //       if (com.error(err, req, res, dataset, 'dataset')) return;
    //       datasets.unshift(dataset);

    //       // Write profile.
    //       var profile = {
    //         user: req.user,
    //         content: {
    //           page: null,
    //           datasets: {
    //             cursor: 1,
    //             more: datasets && datasets.length === 10,
    //             items: datasets,
    //             query: {author_id: user._id}
    //           }
    //         }
    //       };
    //       if (notes)
    //         profile.notes = {
    //           cursor: 1,
    //           more: notes.length === 5,
    //           items: notes
    //         };

    //       // Send profile.
    //       res.send(com.client(profile));
    //     }
    //   );
    // });

  });

  // View profile
  app.get('/service/view.profile/:un/:slug', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {

          // Get view.
          db.Views.read({slug: req.params.slug, author_id: user._id},
              {inflate: {author: profiles.user}}, req.user ? this.parallel(): this);
          if (req.user) {
            db.Datasets.list({author_id: req.user._id},
                {inflate: {author: profiles.user}, limit: 10, 
                sort: {created: -1}}, this.parallel());
            if (req.query.n !== '0')
              db.Notifications.list({subscriber_id: req.user._id},
                  {sort: {created: -1}, limit: 5,
                  inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, view, datasets, notes) {
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
          if (notes)
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };

          // Send profile.
          res.send(com.client(profile));
        }
      );
    });

  });

  // User profile
  app.get('/service/user.profile/:un', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un.toLowerCase()},
        function (err, user) {
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

          // Get notifications.
          if (req.user && req.query.n !== '0')
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
        },
        function (err, datasets, views, notes) {
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
          if (notes)
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
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

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {

    // Write static.
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Chart
  app.get('/chart', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Logout
  app.get('/logout', function (req, res) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.logout();
    res.redirect(url.format(referer) || '/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // View
  app.get('/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // User profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {

    res.render('static', {root: app.get('ROOT_URI')});
  }));

}
