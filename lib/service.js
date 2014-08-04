/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var url = require('url');
var util = require('util');
var Step = require('step');
var fs = require('fs');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common');
var Client = require('./client').Client;
var Events = require('./resources/event');
var profiles = require('./resources').profiles;

// Client-side templates rendered as static pages on server.  These
// are cached in memory for speed
var mission_static = fs.readFileSync('public/templates/mission.html', 'utf8');
var splash_static = fs.readFileSync('public/templates/splash.html', 'utf8');
var signin_static = fs.readFileSync('public/templates/signin.html', 'utf8');
var signup_static = fs.readFileSync('public/templates/signup.html', 'utf8');
var library_static = fs.readFileSync('public/templates/library.html', 'utf8');
var how_static = fs.readFileSync('public/templates/how.html', 'utf8');
var contact_static = fs.readFileSync('public/templates/contact.html', 'utf8');
var privacy_static = fs.readFileSync('public/templates/privacy.html', 'utf8');
var terms_static = fs.readFileSync('public/templates/terms.html', 'utf8');

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
        && req.headers['user-agent']
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1)) {
      return sfn(req, res);
    // Hello google bot
    } else if (parts.query['_escaped_fragment_'] === '') {
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

  /*
   * Get sidebar content for a public user.
   */
  function getPublicSidebarLists(cb) {
    var lists = {datasets: {items: []}, views: {items: []}};

    Step(
      function () {
        db.Users.read({username: 'library'}, this);
      },
      function (err, lib) {
        if (err) return cb(err);
        if (!lib) {
          return cb(null, lists);
        }
        db.Datasets.list({author_id: lib._id}, {inflate: {author: profiles.user},
            limit: 10, sort: {created: -1}}, this.parallel());
        db.Datasets.count({author_id: lib._id}, this.parallel());
      },
      function (err, datasets, count) {
        if (err) return cb(err);
        if (datasets.length === 0) {
          return this();
        }
        lists.datasets.items = datasets;
        lists.datasets.count = count;

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
        db.Users.read({username: 'home'}, this);
      },
      function (err, home) {
        if (err) return cb(err);
        if (!home) {
          return cb(null, lists);
        }
        db.Views.list({author_id: home._id}, {inflate: {author: profiles.user},
            limit: 3, sort: {created: -1}}, this);
      },
      function (err, views) {
        if (err) return cb(err);
        lists.views.items = views;
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
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, req.user ? ['dataset', 'view']: ['view']);

    Step(
      function () {

        // Get events.
        var query = req.user ?
            {user_id: req.user._id, subscriber_id: req.user._id}:
            {public: true};
        Events.feed(query, actions,
            {limit: limit, cursor: cursor}, this.parallel());

        // Get sidebar.
        if (req.user) {
          getSidebarLists(req.user, req.user, this.parallel());
        } else {
          getPublicSidebarLists(this.parallel());
        }

        // Count unread notifications.
        if (req.user) {
          db.Notifications.count({subscriber_id: req.user._id, read: false},
              this.parallel());
        }
      },
      function (err, feed, lists, unread) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          user: req.user,
          content: _.extend(lists, {events: feed.events})
        };
        if (req.user) {
          profile.notifications = unread;
        }

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

                // Update event count.
                db.Events._update({action_id: view._id}, {$inc: {vcnt: 1}},
                    _.bind(function (err) { this(); }, this));
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
            inc: true}, this.parallel());

        // Update event count.
        db.Events._update({action_id: {$in: dids}}, {$inc: {vcnt: 1}},
            {multi: true}, this.parallel());
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
            if (com.error(err, req, res)) return;
            datasets = _.reject(datasets, function (d) {
              return d.reject;
            });
            if (datasets.length === 0) {
              return com.error(null, req, res, undefined, 'dataset');
            }

            // Get notes and comments on this view.
            if (state._id) {
              db.fill(state, 'Notes', 'parent_id', {sort: {beg: -1},
                  inflate: {author: profiles.user}}, this.parallel());
              db.fill(state, 'Comments', 'parent_id', {sort: {created: -1},
                  limit: 5, inflate: {author: profiles.user}}, this.parallel());
            }

            if (datasets.length !== 0) {

              // Find leader.
              var leader_id;
              _.each(state.datasets, function (val, did) {
                if (val.index === 0) leader_id = Number(did);
              });

              // Get dataset channels, notes, and comments on leader.
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

  // Dataset profile
  app.get('/service/dataset/:id', function (req, res) {

    // Get the dataset.
    db.Datasets.read({_id: Number(req.params.id)},
        {inflate: {author: profiles.user}, inc: true}, function (err, dataset) {
      if (com.error(err, req, res, dataset, 'dataset')) return;          

      Step(
        function () {

          // Check access.
          com.hasAccess(req.user, dataset, this);
        },
        function (err, allow) {
          if (com.error(err, req, res)) return;
          if (!allow) {
            return com.error(null, req, res, undefined, 'dataset');
          }

          // Update event count.
          db.Events._update({action_id: dataset._id}, {$inc: {vcnt: 1}}, this);
        }, function (err) {
          if (com.error(err, req, res)) return;

          // Get user subscription.
          if (req.user) {
            db.Subscriptions.read({subscriber_id: req.user._id,
                subscribee_id: dataset._id}, this.parallel());
          }

          // Fill lists.
          db.fill(dataset, 'Channels', 'parent_id', {sort: {created: -1}},
              this.parallel());
          db.fill(dataset, 'Notes', 'parent_id', {sort: {created: -1},
              inflate: {author: profiles.user}}, this.parallel());
          db.fill(dataset, 'Comments', 'parent_id', {sort: {created: -1},
              inflate: {author: profiles.user}}, this.parallel());
        },
        function (err, sub) {
          if (com.error(err, req, res)) return;

          Step(
            function () {
              if (dataset.notes.length === 0) {
                return this();
              }

              // Count replies.
              var _this = _.after(dataset.notes.length, this);
              _.each(dataset.notes, function (n) {
                db.Comments.count({parent_id: n._id}, function (err, cnt) {
                  if (err) {
                    return _this();
                  }
                  n.replies_cnt = cnt;
                  _this();
                });
              });
            },
            function (err) {
              if (com.error(err, req, res)) return;

              // Write profiles
              var profile = {
                user: req.user,
                sub: sub,
                content: {
                  page: dataset,
                }
              };

              // Send profile.
              res.send(com.client(profile));
            }
          );
        }
      );
    });
  });

  // View profile
  app.get('/service/view/:un/:slug', function (req, res) {

    // Get the user.
    db.Users.read({username: req.params.un}, function (err, user) {
      if (com.error(err, req, res, user, 'user')) return;

      // Get the view.
      db.Views.read({slug: req.params.slug, author_id: user._id},
          {inflate: {author: profiles.user}, inc: true}, function (err, view) {
        if (com.error(err, req, res, view, 'view')) return;

        Step(
          function () {

            // Check access.
            com.hasAccess(req.user, view, this);
          },
          function (err, allow) {
            if (com.error(err, req, res)) return;
            if (!allow) {
              return com.error(null, req, res, undefined, 'view');
            }

            // Update event count.
            db.Events._update({action_id: view._id}, {$inc: {vcnt: 1}}, this);
          }, function (err) {
            if (com.error(err, req, res)) return;

            // Get datasets.
            var dids = _.map(view.datasets, function (val, did) {
                return Number(did); });
            db.Datasets.list({_id: {$in: dids}},
                {inflate: {author: profiles.user}}, function (err, datasets) {
              if (com.error(err, req, res)) return;

              Step(
                function () {

                  // Check dataset access.
                  var _this = _.after(datasets.length, this);
                  _.each(datasets, function (d) {
                    com.hasAccess(req.user, d, function (err, allow) {
                      if (err) return _this(err);
                      if (!allow) {
                        d.reject = true;
                        delete view.datasets[d._id];
                      }
                      _this();
                    });
                  });
                },
                function () {
                  if (com.error(err, req, res)) return;
                  datasets = _.reject(datasets, function (d) {
                    return d.reject;
                  });
                  if (datasets.length === 0) {
                    return com.error(null, req, res, undefined, 'dataset');
                  }

                  // Get user subscription.
                  if (req.user) {
                    db.Subscriptions.read({subscriber_id: req.user._id,
                        subscribee_id: view._id}, this.parallel());
                  }

                  // Fill lists.
                  db.fill(view, 'Notes', 'parent_id', {sort: {created: -1},
                      inflate: {author: profiles.user}}, this.parallel());
                  db.fill(view, 'Comments', 'parent_id', {sort: {created: -1},
                      inflate: {author: profiles.user}}, this.parallel());
                },
                function (err, sub) {
                  if (com.error(err, req, res)) return;

                  Step(
                    function () {
                      if (view.notes.length === 0) {
                        return this();
                      }

                      // Count replies.
                      var _this = _.after(view.notes.length, this);
                      _.each(view.notes, function (n) {
                        db.Comments.count({parent_id: n._id}, function (err, cnt) {
                          if (err) {
                            return _this();
                          }
                          n.replies_cnt = cnt;
                          _this();
                        });
                      });
                    },
                    function (err) {
                      if (com.error(err, req, res)) return;

                      // Write profiles
                      var profile = {
                        user: req.user,
                        sub: sub,
                        content: {
                          page: view,
                        }
                      };

                      // Send profile.
                      res.send(com.client(profile));
                    }
                  );
                }
              );
            });
          }
        );
      });
    });
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
      return res.send(403, {error: {message: 'User invalid'}});
    }
    res.send(com.client({user: req.user, content: {page: req.user}}));
  });

  // Settings profile
  app.get('/service/upload', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'User invalid'}});
    }

    // Write profile.
    var profile = {
      user: req.user,
      content: Client.getDateTimeFormats()
    };

    // Send profile.
    res.send(com.client(profile));
  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {
    var template = _.template(splash_static);
    var obj = {static: true};
    res.render('static', {
      key: 'splash',
      body:  template.call(obj),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Signin
  app.get('/signin', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    res.render('static', {
      key: 'mission',
      title: 'Our Mission',
      body: _.template(mission_static, {}),
      root: app.get('ROOT_URI')
    });

    handler(function (req, res) {
      res.render('static', {
        key: 'signin',
        title: 'Signin',
        body: _.template(signin_static, {}),
        root: app.get('ROOT_URI')
      });
    }, 'folder', req, res);
  });

  // Signup
  app.get('/signup', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {
        key: 'signup',
        title: 'Signup',
        body: _.template(signup_static, {}),
        root: app.get('ROOT_URI')
      });
    }, 'folder', req, res);
  });

  // Upload
  app.get('/upload', function (req, res) {
    return res.redirect('/');
  });

  // Library
  app.get('/library', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'library',
      title: 'Library',
      body: _.template(library_static, {}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // How it works
  app.get('/how', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'how',
      title: 'How Skyline Works',
      body: _.template(how_static, {__s: ''}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Mission
  app.get('/mission', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'mission',
      title: 'Our Mission',
      body: _.template(mission_static, {}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Trending
  // Here we create some static content for the crawlers
  app.get('/trending', _.bind(handler, undefined, function (req, res) {

    var items;

    Step(
      function () {

        // Get events.
        Events.feed({public: true}, ['view'],
            {limit: 10, cursor: 0}, this.parallel());
        getPublicSidebarLists(this.parallel());
      },
      function (err, feed, lists) {
        if (com.error(err, req, res)) return;

        // Create some static content
        items = feed.events.items;

        var html = '';
        _.each(items, function(i) {
          html += '<h3>' + i.action.name + '</h3>';
          if (i.action.description) {
            html += '<p>' + i.action.description;
            _.each(i.action.tags, function(t) {
              html += ' #' + t
            });
            html += '</p>';
          }
          html += '<a href="/' + i.action.author.username + '/views/'
               + i.action.slug + '/chart">';
          html += '<img class="event-view-image" src="'
               + i.action.staticImgUrl + '" alt="' + i.action.name + '">'
               + '</a>'
        });

        this.staticContentFeed = html;

        html = '';
        _.each(lists.datasets.items, function (d) {
          html += '<a href="\/' + d.author.username + '\/' + d._id + '"> '
               + '<h3>' + d.title + '<\/h3>' + '<\/a>';
        });

        this.staticContentLists = html;

        var template = _.template(splash_static);
        var body = template.call(this, {splash: false});

        res.render('static', {
          key: 'trending',
          title: 'Trending Content',
          body: body,
          root: app.get('ROOT_URI')
        });

      }
    );
  }, 'folder'));

  // Contact
  app.get('/contact', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'contact',
      title: 'Contact',
      body: _.template(contact_static, {}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Privacy
  app.get('/privacy', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'privacy',
      title: 'Privacy Policy',
      body: _.template(privacy_static, {}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Terms of Use
  app.get('/terms', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'terms',
      title: 'Terms of Use',
      body: _.template(terms_static, {}),
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

  // Upload
  app.get('/upload/:fid', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

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


  // View w/ note
  app.get('/:un/views/:slug/note/:nid', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // View w/ chart
  app.get('/:un/views/:slug/chart', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // View config
  app.get('/:un/views/:slug/config', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // View
  app.get('/:un/views/:slug', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));


  // Dataset w/ note w/ chart
  app.get('/:un/:id/note/:nid/chart', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset w/ note
  app.get('/:un/:id/note/:nid', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset w/ channelName w/ chart
  app.get('/:un/:id/:cn/chart', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset w/ channelName
  app.get('/:un/:id/:cn', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder'));

  // Dataset config
  app.get('/:un/:id/config', _.bind(handler, undefined, function (req, res) {
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
