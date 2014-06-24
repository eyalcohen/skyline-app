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
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1)) {
      return sfn(req, res);
    }

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

    if (!type || type === 'all' || !_.contains(types, type)) {
      return types;
    } else {
      return [type];
    }
  }

  /*
   * Get sidebar content for a user.
   */
  function getSidebarLists(user, requestor, cb) {
    var lists = {datasets: {items: []}, views: {own: {items: []},
        other: {items: []}}, followers: {items: []}, followees: {items: []}};
    if (!user) {
      return cb(null, lists);
    }

    function hasViewAccess(view, list, done) {
      com.hasAccess(requestor, view, function (err, allow) {
        if (err) return done(err);
        if (allow) {
          var _done = _.after(_.size(view.datasets), function (err) {
            if (err) return done(err);
            if (allow) {
              list.push(view);
            }
            done();
          });
          _.each(view.datasets, function (meta, did) {
            db.Datasets.read({_id: Number(did)}, function (err, d) {
              com.hasAccess(requestor, d, function (err, _allow) {
                if (err) return _done(err);
                if (!_allow) {
                  allow = false;
                }
                _done();
              });
            });
          });
        } else {
          done();
        }
      });
    }

    Step(
      function () {
        db.Datasets.list({author_id: user._id}, {inflate: {author: profiles.user},
            sort: {created: -1}}, this.parallel());
        db.Views.list({author_id: user._id}, {inflate: {author: profiles.user},
            sort: {created: -1}}, this.parallel());
        db.Subscriptions.list({subscribee_id: user._id, 'meta.style': 'follow',
            'meta.type': 'user'}, {sort: {created: -1},
            inflate: {subscriber: profiles.user}}, this.parallel());
        db.Subscriptions.list({subscriber_id: user._id, 'meta.style': 'follow',
            'meta.type': 'user'}, {sort: {created: -1},
            inflate: {subscribee: profiles.user}}, this.parallel());
      },
      function (err, datasets, views, followers, followees) {
        if (err) return cb(err);
        lists.followers.items = followers;
        lists.followees.items = followees;

        Step(
          function () {
            if (datasets.length === 0) {
              return this();
            }
            var group = this.group();
            _.each(datasets, function (d) {
              var key = 'datasets.' + d._id;
              var query = {author_id: {$ne: user._id}};
              query[key] = {$exists: true};
              db.Views.list(query, {inflate: {author: profiles.user},
                  sort: {created: -1}}, group());
            });
          },
          function (err, _views) {
            if (err) return cb(err);
            _views = _.uniq(_.flatten(_views), function (v) {
              return v._id;
            });

            var num = datasets.length + views.length + _views.length;
            if (num === 0) {
              return this();
            }
            
            // Check access.
            var _this = _.after(num, this);
            _.each(datasets, function (d) {
              com.hasAccess(requestor, d, function (err, allow) {
                if (err) return _this(err);
                if (allow) {
                  lists.datasets.items.push(d);
                }
                _this();
              });
            });
            _.each(views, function (v) {
              hasViewAccess(v, lists.views.own.items, _this)
            });
            _.each(_views, function (v) {
              hasViewAccess(v, lists.views.other.items, _this)
            });
          }, this
        );
      },
      function (err) {
        if (err) return cb(err);
        if (lists.datasets.length === 0) {
          return this();
        }

        // Get the 'end' time of all channels in streaming Datasets
        // to get a 'last seen'
        var streaming = _.compact(_.reject(lists.datasets.items, function (d) {
          return d.file;
        }));
        Step(
          function () {
            var group = this.group();
            _.each(streaming, function (d) {
              db.Channels.list({parent_id: d._id}, group());
            });
          },
          function (err, docs) {
            if (err) return cb(err);
            _.each(streaming, function(d, idx) {
              var sorted = _.sortBy(docs[idx], 'end');
              if (sorted[docs[idx].length - 1] && sorted[docs[idx].length-1].end) {
                d.lastSeen = sorted[docs[idx].length - 1].end;
              }
            });
            this();
          }, this
        );
        
      },
      function (err) {
        if (err) return cb(err);

        // Sort.
        lists.datasets.items.sort(function (a, b) {
          return b.created - a.created;
        });
        lists.views.own.items.sort(function (a, b) {
          return b.created - a.created;
        });
        lists.views.other.items.sort(function (a, b) {
          return b.created - a.created;
        });

        cb(err, lists);
      }
    );
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static', function (req, res) {
    res.send(com.client({user: req.user, content: {page: null}}));
  });

  // Dashboard profile
  app.get('/service/dashboard', function (req, res) {
    if (!req.user) {
      return res.send(com.client({user: null, content: {page: null}}));
    }
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['dataset', 'view']);
    
    Step(
      function () {

        // Get events.
        Events.feed({user_id: req.user._id, subscriber_id: req.user._id}, actions,
            {limit: limit, cursor: cursor}, this.parallel());

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Count unread notifications.
        db.Notifications.count({subscriber_id: req.user._id, read: false},
            this.parallel());
      },
      function (err, feed, lists, unread) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          notifications: unread,
          content: _.extend(lists, {events: feed.events})
        };

        // Send profile.
        res.send(com.client(profile));
      }
    );
  });

  // Home profile
  app.get('/service/notifications', function (req, res) {
    if (!req.user) {
      return res.send(com.client({user: null, content: {page: null}}));
    }

    Step(
      function () {

        // Get notifications.
        db.Notifications.list({subscriber_id: req.user._id},
            {sort: {created: -1}, limit: 10,
            inflate: {event: profiles.event}}, this.parallel());

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Count unread notifications.
        db.Notifications.count({subscriber_id: req.user._id, read: false},
            this.parallel());
      },
      function (err, notifications, lists, unread) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          notifications: unread,
          content: _.extend(lists, {
            notifications: {
              cursor: 1,
              more: notifications.length === 10,
              items: notifications
            }
          })
        };

        // Send profile.
        res.send(com.client(profile));
      }
    );
  });

  // Chart profile
  app.get('/service/chart', function (req, res) {
    var parts = url.parse(req.url, true);
    var state = parts.query['state'];
    var embed = parts.query['embed'];
    if (!state || state === 'undefined') {
      if (embed) {
        return res.send(com.client({user: null, content: {page: null}}));
      } else {
        return res.redirect('/service/static');
      }
    }
    try { state = JSON.parse(state); }
    catch (e) { return res.redirect('/service/static'); }

    Step(
      function () {

        // Use datasets from a saved view or supplied state.
        if (state.key) {

          // Get view user.
          db.Users.read({username: state.key.un}, _.bind(function (err, user) {
            if (com.error(err, req, res, user, 'user')) return;
            
            // Get view
            db.Views.read({slug: state.key.slug, author_id: user._id},
                {inflate: {author: profiles.user}, inc: true},
                _.bind(function (err, view) {
              if (com.error(err, req, res, view, 'view')) return;

              // Check access.
              com.hasAccess(req.user, view, _.bind(function (err, allow) {
                if (err) return this(err);
                if (!allow) {
                  return com.error(null, req, res, undefined, 'view');
                }

                // View is the actual state.
                state = view;
                this();
              }, this));
            }, this));
          }, this));

        } else this();
      },
      function (err) {
        if (err) return this(err);
        var dids = _.map(state.datasets, function (val, did) {
            return Number(did); });

        // Get datasets.
        db.Datasets.list({_id: {$in: dids}}, {inflate: {author: profiles.user},
            inc: true}, this);
      },
      function (err, datasets) {
        if (com.error(err, req, res)) return;

        Step(
          function () {
            if (!state._id && datasets.length === 0) {
              return this();
            }

            // Check access.
            var _this = _.after(datasets.length, this);
            _.each(datasets, function (d) {
              com.hasAccess(req.user, d, function (err, allow) {
                if (err) return _this(err);
                if (!allow) {
                  d.reject = true;
                  delete state.datasets[d._id];
                }
                _this();
              });
            });
          },
          function (err) {
            if (err) return this(err);
            datasets = _.reject(datasets, function (d) {
              return d.reject;
            });
            if (!state._id && datasets.length === 0) {
              return this();
            }

            // Get notes and comments on this view.
            if (state._id) {
              db.fill(state, 'Notes', 'parent_id', {sort: {beg: -1},
                  inflate: {author: profiles.user}}, this.parallel());
              db.fill(state, 'Comments', 'parent_id', {sort: {created: -1},
                  limit: 5, inflate: {author: profiles.user}}, this.parallel());
            }

            // Get dataset channels and notes.
            if (datasets.length !== 0) {

              // Find leader.
              var leader_id;
              _.each(state.datasets, function (val, did) {
                if (val.index === 0) leader_id = Number(did);
              });

              _.each(datasets, _.bind(function (d) {
                db.fill(d, 'Channels', 'parent_id', {sort: {created: -1}, inc: true},
                    this.parallel());
                db.fill(d, 'Notes', 'parent_id', {sort: {beg: -1},
                    inflate: {author: profiles.user}}, this.parallel());
                if (!state._id && d._id === leader_id) {
                  db.fill(d, 'Comments', 'parent_id', {sort: {created: -1},
                      limit: 5, inflate: {author: profiles.user}},
                      this.parallel());
                }
              }, this));
            }
          },
          function (err) {
            if (com.error(err, req, res)) return;
            if (datasets.length === 0) {
              return com.error(null, req, res, undefined, 'dataset');
            }

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

            // Send profile.
            res.send(com.client(profile));
          }
        );

      }
    );

  });

  // User profile
  app.get('/service/user/:un', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['dataset', 'view']);

    // Get the user.
    db.Users.read({username: req.params.un.toLowerCase()},
        function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      Step(
        function (err) {
          if (com.error(err, req, res)) return;

          Step(
            function () {

              // Get events feed.
              Events.feed({user_id: req.user ? req.user._id: null,
                  subscribee_id: user._id, subscribee_type: 'user',
                  subscribee_privacy: user.config.privacy.mode}, actions,
                  {limit: limit, cursor: cursor}, this.parallel());

              // Get sidebar.
              getSidebarLists(user, req.user, this.parallel());
            },
            function (err, feed, lists) {
              if (com.error(err, req, res)) return;

              // Write profile.
              delete user.password;
              delete user.salt;
              user.gravatar = com.hash(user.primaryEmail || 'foo@bar.baz');
              var profile = {
                user: req.user,
                sub: feed.subscription,
                content: _.extend(lists, {
                  page: user,
                  events: feed.events,
                  private: feed.private
                })
              };

              // Send profile.
              res.send(com.client(profile));
            }
          );
        }
      );
    });
  });

  // Library profile
  app.get('/service/library', function (req, res) {

    // Get the user.
    db.Users.read({username: 'library'}, function (err, library) {
      if (com.error(err, req, res, library, 'library')) return;

      // Get all datasets from library.
      db.Datasets.list({author_id: library._id}, {sort: {created: -1}},
          function (err, datasets) {
        if (com.error(err, req, res)) return;

        Step(
          function () {
            if (datasets.length === 0) return this();

            // Fill channels.
            _.each(datasets, _.bind(function (d) {
              db.fill(d, 'Channels', 'parent_id', {sort: {created: -1}, limit: 5},
                  this.parallel());
            }, this));
          },
          function (err) {
            if (com.error(err, req, res)) return;
            if (!req.user) return this();

            // Get user subscription.
            db.Subscriptions.read({subscriber_id: req.user._id,
                subscribee_id: library._id}, this);
          },
          function (err, sub) {
            if (com.error(err, req, res)) return;

            // Write profile.
            var profile = {
              user: req.user,
              sub: sub,
              content: {
                page: library,
                datasets: datasets
              }
            };

            // Send profile.
            res.send(com.client(profile));
          }
        );

      });
    });
  });

  // Settings profile
  app.get('/service/settings', function (req, res) {
    if (!req.user) {
      return res.send(com.client({user: null, content: {page: null}}));
    }
    res.send(com.client({user: req.user, content: {page: req.user}}));
  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {
    res.render('static', { root: app.get('ROOT_URI')});
  }, 'folder'));

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Signin
  app.get('/signin', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', req, res);
  });

  // Signup
  app.get('/signup', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', req, res);
  });

  // Library
  app.get('/library', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'library',
      title: 'Library',
      body: '...',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // About
  app.get('/about', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'about',
      title: 'About',
      body: '...',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Contact
  app.get('/contact', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'contact',
      title: 'Contact',
      body: '...',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Privacy
  app.get('/privacy', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'privacy',
      title: 'Privacy Policy',
      body: '...',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Terms of Use
  app.get('/terms', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'terms',
      title: 'Terms of Use',
      body: '...',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Settings
  app.get('/settings', function (req, res) {
    if (!req.user) {
      return res.redirect('/');
    }
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
        if (!key) {
          return res.redirect('/');
        }

        // Get the user for the key.
        db.Users.read({_id: key.user_id}, function (err, user) {
          if (com.error(err, req, res)) return;
          if (!user) {
            return res.redirect('/');
          }

          // Login.
          req.login(user, function (err) {
            if (com.error(err, req, res)) return;
            res.redirect('/settings');
          });
        });
      });
    } else {
      res.redirect('/settings');
    }
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
    if (token) {
      db.Keys.read({_id: db.oid(token)}, function (err, key) {
        if (com.error(err, req, res)) return;
        if (!key) {
          return res.redirect('/');
        }

        // Get the user for the key.
        db.Users.read({_id: key.user_id}, function (err, user) {
          if (com.error(err, req, res)) return;
          if (!user) {
            return res.redirect('/');
          }

          // Attach the token to the session
          // so we can grab it later and verify.
          req.session.reset_token = token;

          // Handoff to the front-end.
          _handle();
        });
      });
    } else if (req.user) {
      _handle();
    } else {
      res.redirect('/');
    }
  });

  // Logout
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // Embedded View
  app.get('/embed/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Embedded Dataset w/ channelName
  app.get('/embed/:un/:id/:cn', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Embedded Dataset
  app.get('/embed/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // View
  app.get('/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset w/ channelName
  app.get('/:un/:id/:cn', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset
  app.get('/:un/:id', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // User profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));
}
