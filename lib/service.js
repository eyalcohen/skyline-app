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
  function handler(sfn, embed, req, res) {
    if (!_.isBoolean(embed)) {
      res = req;
      req = embed;
      embed = false;
    }

    // Handle the request statically if the user-agent
    // is from Facebook's url scraper or if specifically requested.
    var parts = url.parse(req.url, true);
    if (parts.query['static'] === 'true' || (req.headers
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1))
      return sfn(req, res);

    // Handle the request normally.
    res.render('index', {
      user: req.user,
      root: app.get('ROOT_URI'),
      embed: embed
    });
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static.profile', function (req, res) {
    
    Step(
      function () {
        if (!req.user) return this();

        // Get lists and notifications.
        db.Datasets.list({author_id: req.user._id},
            {inflate: {author: profiles.user, parent: profiles.dataset},
            sort: {created: -1}}, this.parallel());
        db.Views.list({author_id: req.user._id},
            {inflate: {author: profiles.user, parent: profiles.view},
            sort: {created: -1}}, this.parallel());
        if (req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, datasets, views, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: {
            page: null,
            datasets: {
              more: false,
              items: datasets || [],
            },
            views: {
              more: false,
              items: views || [],
            },
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

  // Home profile
  app.get('/service/home.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));

    function listEvents(cb) {

      Step(
        function () {

          // Get events where actor is user.
          db.Events.list({actor_id: req.user._id},
              {sort: {created: -1}, limit: 5}, this.parallel());

          // Get following.
          db.Subscriptions.list({subscriber_id: req.user._id, mute: false,
              'meta.style': 'follow'}, this.parallel());

        },
        function (err, events, subs) {
          if (err) return cb(err);
          if (subs.length === 0) return cb(null, events);

          Step(
            function () {
              
              var _this = _.after(subs.length, this);
              _.each(subs, function (s) {

                // Get events where actor is subscribee.
                db.Events.list({actor_id: s.subscribee_id, public: {$ne: false}},
                    {sort: {created: -1}, limit: 5}, _.bind(function (err, docs) {
                  if (err) return this(err);

                  // Gather events.
                  events.push.apply(events, docs);
                  _this();
                }, this));
              });
            },
            function (err) {
              if (err) return cb(err);

              // Sort events.
              cb(null, events.sort(function (a, b) {
                return b.created - a.created;
              }));
            }
          );
        }
      );
    }

    Step(
      function () {

        // Get events for this user.
        listEvents(this.parallel());

        // Get lists and notifications.
        db.Datasets.list({author_id: req.user._id},
            {inflate: {author: profiles.user, parent: profiles.dataset},
            sort: {created: -1}}, this.parallel());
        db.Views.list({author_id: req.user._id},
            {inflate: {author: profiles.user, parent: profiles.view},
            sort: {created: -1}}, this.parallel());
        if (req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, events, datasets, views, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: {
            page: null,
            events: {
              cursor: 1,
              more: events.length !== 0,
              items: events
            },
            datasets: {
              more: false,
              items: datasets
            },
            views: {
              more: false,
              items: views
            },
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

  // Chart profile
  app.get('/service/chart.profile', function (req, res) {
    var parts = url.parse(req.url, true);
    var state = parts.query['state'];
    var embed = parts.query['embed'];
    if (!state)
      if (embed)
        return res.send(com.client({user: null, content: {page: null}}));
      else
        return res.redirect('/service/static.profile');
    try { state = JSON.parse(state); }
    catch (e) { return res.redirect('/service/static.profile'); }

    Step(
      function () {

        // Use datasets from a saved view or supplied state.
        if (state.key) {

          // Get view user.
          db.Users.read({username: state.key.un}, _.bind(function (err, user) {
            if (com.error(err, req, res, user, 'user')) return;
            
            // Get view
            db.Views.read({slug: state.key.slug, author_id: user._id},
                {inflate: {author: profiles.user, parent: profiles.view}},
                _.bind(function (err, view) {
              if (com.error(err, req, res, view, 'view')) return;

              // Check private.
              if (view.public === false)
                if (!req.user || req.user._id.toString()
                    !== view.author._id.toString()) return this('User invalid');

              // Get parent author.
              db.inflate(view.parent, {author: profiles.user}, _.bind(function (err) {

                // View is the actual state.
                state = view;
                this(null, state.datasets);
              }, this));

            }, this));
          }, this));

        } else this(null, state.datasets);
      },
      function (err, datasets) {
        if (com.error(err, req, res)) return;

        var dids = _.map(datasets, function (val, did) {
            return Number(did); });

        // Get datasets.
        db.Datasets.list({_id: {$in: dids}},
            {inflate: {author: profiles.user, parent: profiles.dataset}},
            req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0' && !embed)
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, datasets, notes) {
        if (com.error(err, req, res)) return;

        // Check private.
        _.each(datasets, function (d) {
          if (d.public === false)
            if (!req.user || req.user._id.toString()
                !== d.author._id.toString()) {
              delete state.datasets[d._id];
              d = false;
            }
        });
        _.compact(datasets);

        Step(
          function () {
            if (!state._id && datasets.length === 0)
              return this();

            // Get comment on this state.
            if (state._id) {
              db.fill(state, 'Comments', 'parent_id', {sort: {time: 1},
                  inflate: {author: profiles.user}},
                  datasets.length === 0 ? this: this.parallel());
            }

            // Get dataset comments.
            if (datasets.length !== 0)
              _.each(datasets, _.bind(function (d) {
                db.fill(d, 'Comments', 'parent_id', {sort: {time: 1},
                    inflate: {author: profiles.user}}, this.parallel());
              }, this));
          },
          function (err) {

            // Write profile.
            var profile = {
              user: req.user,
              state: state,
              content: {
                page: state._id ? state: null,
                datasets: {
                  items: datasets || []
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

      }
    );

  });

  // User profile
  app.get('/service/user.profile/:un', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un.toLowerCase()},
        function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function () {
          var query = {author_id: user._id};
          if (!req.user || req.user._id.toString() !== user._id.toString())
            query.public = {$ne: false};

          // Get datasets.
          db.Datasets.list(query,
            {inflate: {author: profiles.user, parent: profiles.dataset},
            limit: 10, sort: {updated: -1}}, this.parallel());

          // Get views.
          db.Views.list(query,
            {inflate: {author: profiles.user, parent: profiles.view},
            limit: 10, sort: {created: -1}}, this.parallel());

          // Get notifications.
          if (req.user && req.query.n !== '0')
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
        },
        function (err, datasets, views, notes) {
          if (com.error(err, req, res)) return;

          Step(
            function () {
              if (datasets.length === 0 && views.length === 0)
                return this();

              // Get parent authors.
              var _this = _.after(datasets.length + views.length, this);
              _.each(datasets, function (d) {
                db.inflate(d.parent, {author: profiles.user}, _this);
              });
              _.each(views, function (d) {
                db.inflate(d.parent, {author: profiles.user}, _this);
              });
            },
            function (err) {
              if (com.error(err, req, res)) return;

              // Get follow status.
              if (req.user._id.toString() === user._id.toString())
                return this(null, false);
              db.Subscriptions.read({subscribee_id: user._id,
                  subscriber_id: req.user._id, 'meta.style': 'follow'}, this);
            },
            function (err, sub) {
              if (com.error(err, req, res)) return;

              // Write profile.
              delete user.password;
              delete user.salt;
              user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
              var profile = {
                user: req.user,
                sub: sub,
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

        }
      );
    });

  });

  // About
  app.get('/about', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'about',
      title: 'About',
      body: 'Skyline is...',
      root: app.get('ROOT_URI')
    });
  }));

  // Contact
  app.get('/contact', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'contact',
      title: 'Contact',
      body: 'Get in touch at hello@skyli.ne.',
      root: app.get('ROOT_URI')
    });
  }));

  // Privacy Policy
  app.get('/privacy', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'privacy',
      title: 'Privacy',
      body: 'This Privacy Policy governs the manner in which Skyline'
          + ' collects, uses, maintains and discloses information collected'
          + ' from users (each, a "User") of the http://skyli.ne website'
          + ' ("Site"). This privacy policy applies to the Site and all'
          + ' products and services offered by Skyline.',
      root: app.get('ROOT_URI')
    });
  }));

  // Settings profile
  app.get('/service/settings.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));

    if (req.query.n === '0')
      return res.send(com.client({
        user: req.user,
        content: {page: req.user}
      }));

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Write and send profile.
      res.send(com.client({
        user: req.user,
        content: {page: req.user},
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

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

  // Settings
  app.get('/settings', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });
  app.get('/settings/:k', function (req, res) {

    // If there is no user, try a login from the key.
    // (these come from emails)
    if (!req.user) {
      db.Keys.read({_id: db.oid(req.params.k)}, function (err, key) {
        if (com.error(err, req, res)) return;
        if (!key) return res.redirect('/');

        // Get the user for the key.
        db.Users.read({_id: key.user_id}, function (err, user) {
          if (com.error(err, req, res)) return;
          if (!user) return res.redirect('/');

          // Login.
          req.login(user, function (err) {
            if (com.error(err, req, res)) return;
            res.redirect('/settings');
          });
        });
      });
    } else res.redirect('/settings');
  });

  // Reset
  app.get('/reset', function (req, res) {
    var parts = url.parse(req.url, true);
    var token = parts.query['t'];

    function _handle() {
      handler(function (req, res) {
        res.render('static', {root: app.get('ROOT_URI')});
      }, req, res);
    }

    // Check for token.
    if (token)
      db.Keys.read({_id: db.oid(token)}, function (err, key) {
        if (com.error(err, req, res)) return;
        if (!key) return res.redirect('/');

        // Get the user for the key.
        db.Users.read({_id: key.user_id}, function (err, user) {
          if (com.error(err, req, res)) return;
          if (!user) return res.redirect('/');

          // Attach the token to the session
          // so we can grab it later and verify.
          req.session.reset_token = token;

          // Handoff to the front-end.
          _handle();
        });
      });
    else if (req.user) _handle();
    else res.redirect('/');
  });

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

  // Dataset
  app.get('/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Embedded Dataset
  app.get('/embed/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, true));

  // View
  app.get('/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Embedded View
  app.get('/embed/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, true));

  // User profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

}
