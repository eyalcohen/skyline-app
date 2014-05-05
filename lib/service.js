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
var Events = require('./resources/event');
var profiles = require('./resources').profiles;

// Define routes.
exports.routes = function (app) {

  /*
   * HTTP request handler.
   */
  function handler(sfn, template, embed, req, res) {
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
    res.render(template, {
      user: req.user,
      root: app.get('ROOT_URI'),
      embed: embed
    });
  }

  /*
   * Pull requested event action types from request.
   */
  function parseEventActions(req, types) {
    var query = url.parse(req.url, true).query;
    var type = query['actions'];
    type = type.replace(/"/g, "");

    if (!type || type === 'all' || !_.contains(types, type))
      return types;
    else return [type];
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
  app.get('/service/dashboard.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({user: null, content: {page: null}}));
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['dataset', 'view']);
    
    Step(
      function () {
        var par = req.user && req.query.n !== '0';

        // Get events and notifications.
        Events.feed({subscriber_id: req.user._id}, actions,
            {limit: limit, cursor: cursor},
            par ? this.parallel(): this);
        if (par)
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, events, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: {
            events: events,
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
    if (!state || state === 'undefined')
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
                {inflate: {author: profiles.user}},
                _.bind(function (err, view) {
              if (com.error(err, req, res, view, 'view')) return;

              // Check private.
              if (view.public === false)
                if (!req.user || req.user._id.toString()
                    !== view.author._id.toString()) return this('User invalid');

              // Get parent author.
              // db.inflate(view.parent, {author: profiles.user}, _.bind(function (err) {

                // View is the actual state.
                state = view;
                this();
              // }, this));

            }, this));
          }, this));

        } else this();
      },
      function (err) {
        if (com.error(err, req, res)) return;

        var dids = _.map(state.datasets, function (val, did) {
            return Number(did); });

        // Get datasets.
        db.Datasets.list({_id: {$in: dids}},
            {inflate: {author: profiles.user}},
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
        var leader_id;
        _.each(state.datasets, function (val, did) {
          if (val.index === 0) leader_id = Number(did);
        });

        Step(
          function () {
            if (!state._id && datasets.length === 0)
              return this();

            // Get notes and comments on this view.
            if (state._id) {
              db.fill(state, 'Notes', 'parent_id', {sort: {beg: -1},
                  inflate: {author: profiles.user}}, this.parallel());
              db.fill(state, 'Comments', 'parent_id', {sort: {created: -1},
                  limit: 5, inflate: {author: profiles.user}}, this.parallel());
            }

            // Get dataset channels and notes.
            if (datasets.length !== 0)
              _.each(datasets, _.bind(function (d) {
                db.fill(d, 'Channels', 'parent_id', {sort: {created: -1}}, this.parallel());
                db.fill(d, 'Notes', 'parent_id', {sort: {beg: -1},
                    inflate: {author: profiles.user}}, this.parallel());
                if (!state._id && d._id === leader_id) {
                  db.fill(d, 'Comments', 'parent_id', {sort: {created: -1},
                      limit: 5, inflate: {author: profiles.user}}, this.parallel());
                }
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
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['dataset', 'view']);

    // Get the user.
    db.Users.read({username: req.params.un.toLowerCase()},
        function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      var own = req.user && req.user._id.toString() === user._id.toString();
      Step(
        function () {

          // Get follow status.
          if (req.user && req.user._id.toString() !== user._id.toString())
            db.Subscriptions.read({subscribee_id: user._id,
                subscriber_id: req.user._id}, this);
          else this();
        },
        function (err, sub) {
          if (com.error(err, req, res)) return;
          var feed = user.config.privacy.mode.toString() === '0'
              || (sub && sub.meta.style === 'follow') || own;

          Step(
            function () {
              if (!feed && !(req.user && req.query.n !== '0'))
                return this();

              // Get events.
              if (feed) {
                Events.feed({subscribee_id: user._id}, actions,
                    {limit: limit, cursor: cursor}, this.parallel());
              }

              // Get notifications.
              if (req.user && req.query.n !== '0') {
                db.Notifications.list({subscriber_id: req.user._id},
                    {sort: {created: -1}, limit: 5,
                    inflate: {event: profiles.event}}, this.parallel());
              }
            },
            function (err, events, notes) {
              if (com.error(err, req, res)) return;
              if (!feed) {
                notes = events;
                events = {items: []};
              }

              // Write profile.
              delete user.password;
              delete user.salt;
              user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
              var profile = {
                user: req.user,
                sub: sub,
                content: {
                  page: user,
                  events: events,
                  private: !feed
                }
              };
              if (notes) {
                profile.notes = {
                  cursor: 1,
                  more: notes.length === 5,
                  items: notes
                };
              }

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
  }, 'folder'));

  // Contact
  app.get('/contact', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'contact',
      title: 'Contact',
      body: 'Get in touch at hello@skyli.ne.',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

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
  }, 'folder'));

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
  app.get('/', function (req, res) {
    var template = req.user ? 'folder': 'splash';
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, template, req, res);
  });

  // Settings
  app.get('/settings', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', req, res);
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
      }, 'folder', req, res);
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
    req.logout();
    res.redirect('/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // Dataset
  app.get('/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset w/ channelName
  app.get('/:un/:id/:cn', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Embedded Dataset
  app.get('/embed/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Embedded Dataset w/ channelName
  app.get('/embed/:un/:id/:cn', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // View
  app.get('/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Embedded View
  app.get('/embed/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // User profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));
}
