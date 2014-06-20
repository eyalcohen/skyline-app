/*
 * pubsub.js: Handling for pub sub.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
_.mixin(require('underscore.deep'));
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;

// Constuctor
var PubSub = exports.PubSub = function (params) {
  this.mailer = (params || {}).mailer;
}

// Set socketio.
PubSub.prototype.setSocketIO = function (sio) {
  this.sio = sio;
}

// Subscribe user to an entity.
PubSub.prototype.subscribe = function (subscriber, subscribee, meta, cb) {
  if (!cb) cb = function(){};
  var self = this;
  if (typeof subscriber._id === 'string') {
    subscriber._id = db.oid(subscriber._id);
  }
  if (typeof subscribee._id === 'string') {
    subscribee._id = db.oid(subscribee._id);
  }
  var props = {
    subscriber_id: subscriber._id,
    subscribee_id: subscribee._id,
    meta: meta,
    mute: false
  };
  db.Subscriptions.create(props, function (err, subscription) {
    if (err && err.code !== 11000 || !subscription) {
      return cb(err);
    }

    // Publish event.
    if (meta.style !== 'watch') {
      self.publish(meta.style, meta.style + '.new', {
        data: subscription,
        event: {
          actor_id: subscription.subscriber_id,
          target_id: subscription.subscribee_id,
          action_id: subscription._id,
          action_type: meta.style,
          data: {
            action: {
              i: subscription.subscriber_id.toString(),
              a: subscriber.displayName,
              g: com.hash(subscriber.primaryEmail || 'foo@bar.baz'),
              t: meta.style,
              s: subscriber.username
            },
            target: {
              i: subscription.subscribee_id.toString(),
              a: subscribee.displayName,
              s: subscribee.username
            }
          }
        },
        options: {
          method: 'WITH_SUBSCRIPTION',
          subscription_id: subscription._id
        },
        notify: {subscribee: true}
      });
    }

    cb(null, subscription);
  });
}

// Unsubscribe user to an entity.
PubSub.prototype.unsubscribe = function (subscriber, subscribee, cb) {
  if (!cb) cb = function(){};
  var self = this;
  var props = {
    subscriber_id: subscriber._id ? subscriber._id: subscriber,
    subscribee_id: subscribee._id ? subscribee._id: subscribee
  };
  db.Subscriptions.read(props, function (err, sub) {
    if (err || !sub) {
      return cb(err);
    }

    Step(
      function () {

        // Remove subscription and list it's notes.
        db.Subscriptions.remove({_id: sub._id}, this.parallel());
        db.Notifications.list({subscription_id: sub._id}, this.parallel());
      },
      function (err, stat, notes) {
        if (err || !stat) {
          return this(err);
        }

        // Publish removed statuses.
        _.each(notes, function (note) {
          self.publish('usr-' + note.subscriber_id.toString(),
              'notification.removed', {data: {id: note._id.toString()}});
        });

        // Remove notes.
        db.Notifications.remove({subscription_id: sub._id}, this);
      },
      function (err, stat) {
        if (err) return cb(err);
        cb(null, sub);
      }
    );
  });
}

// Accept user follow request.
PubSub.prototype.accept = function (subscription, cb) {
  if (!cb) cb = function(){};
  var self = this;

  Step(
    function () {

      // Get subscription users.
      db.Users.read({_id: subscription.subscriber_id}, this.parallel());
      db.Users.read({_id: subscription.subscribee_id}, this.parallel());

      // Update subscription style.
      db.Subscriptions.update({_id: subscription._id},
          {$set: {'meta.style': 'follow'}}, this.parallel());
    },
    function (err, subscriber, subscribee, stat) {
      if (err || !subscriber || !subscribee || !stat) {
        return cb(err);
      }

      // Publish accept event.
      self.publish('accept', 'accept.new', {
        data: subscription,
        event: {
          actor_id: subscription.subscribee_id,
          target_id: subscription.subscriber_id,
          action_id: subscription._id,
          action_type: 'accept',
          data: {
            action: {
              i: subscription.subscribee_id.toString(),
              a: subscribee.displayName,
              g: com.hash(subscribee.primaryEmail || 'foo@bar.baz'),
              t: 'accept',
              s: subscribee.username
            },
            target: {
              i: subscription.subscriber_id.toString(),
              a: subscriber.displayName,
              s: subscriber.username
            }
          }
        },
        options: {
          method: 'WITH_SUBSCRIPTION',
          subscription_id: subscription._id
        },
        notify: {subscriber: true}
      });

      // Publish follow event.
      self.publish('follow', 'follow.new', {
        data: subscription,
        event: {
          actor_id: subscription.subscriber_id,
          target_id: subscription.subscribee_id,
          action_id: subscription._id,
          action_type: 'follow',
          data: {
            action: {
              i: subscription.subscriber_id.toString(),
              a: subscriber.displayName,
              g: com.hash(subscriber.primaryEmail || 'foo@bar.baz'),
              t: 'follow',
              s: subscriber.username
            },
            target: {
              i: subscription.subscribee_id.toString(),
              a: subscribee.displayName,
              s: subscribee.username
            }
          }
        },
        options: {
          method: 'WITH_SUBSCRIPTION',
          subscription_id: subscription._id
        },
        notify: {subscribee: true}
      });

      cb(null, subscription);
    }
  );
}

// Publish data over a channel with a topic.
// Optionally create an event.
// Optionally create a notification.
PubSub.prototype.publish = function (channel, topic, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = {};
  }
  params = _.deepClone(params || {});
  cb = cb || function(){};
  if (!channel || !topic || !params.data) {
    return cb('Invalid data');
  }
  var self = this;

  var options = _.defaults(params.options || {}, {
    method: 'DEMAND_SUBSCRIPTION'
  });

  // Publish raw data (for static lists, tickers).
  if (self.sio) {
    if (params.data.public !== false) {
      self.sio.sockets.in(channel).emit(topic, com.client(params.data));
    } else {
      var author_id = params.data.author ? params.data.author._id:
          params.data.author_id;
      self.sio.sockets.in('usr-' + author_id.toString())
          .emit(topic, com.client(params.data));
    }
  }

  // Create the event.
  if (!params.event) {
    return cb();
  }
  params.event.date = params.data.date || params.data.created;
  db.Events.create(params.event, function (err, event) {
    if (err) return cb(err);

    Step(
      function () {
        var query;

        if (options.method === 'DEMAND_SUBSCRIPTION') {

          // Get 'follow' subscriptions.
          query = {
            subscribee_id: event.actor_id,
            'meta.style': 'follow',
            mute: false
          };

          // Get 'watch' subscriptions (if there's something to watch).
          if (event.target_id) {
            query = {$or: [query, {
              subscribee_id: event.target_id,
              'meta.style': 'watch',
              mute: false
            }]};
          }
        } else if (options.method === 'DEMAND_WATCH_SUBSCRIPTION') {

          // Get 'watch' subscriptions (if there's something to watch).
          if (event.target_id) {
            query = {
              subscribee_id: event.target_id,
              'meta.style': 'watch',
              mute: false
            };
          }
        } else if (options.method === 'DEMAND_WATCH_SUBSCRIPTION_FROM_AUTHOR') {

          // Get 'watch' subscriptions (if there's something to watch).
          if (event.target_id && event.target_author_id) {
            query = {
              subscriber_id: event.target_author_id,
              subscribee_id: event.target_id,
              'meta.style': 'watch',
              mute: false
            };
          }
        } else if (options.method === 'WITH_SUBSCRIPTION') {
          query = {_id: options.subscription_id};
        }

        // List subs.
        if (!query) {
          return this(null, []);
        }
        var inflate = {
          subscriber: _.extend(_.clone(profiles.user), {
            primaryEmail: 1,
            config: 1
          })
        };
        if (params.notify && params.notify.subscribee) {
          inflate.subscribee = _.extend(_.clone(profiles.user), {
            primaryEmail: 1,
            config: 1
          });
        }
        db.Subscriptions.list(query, {inflate: inflate}, this);
      },
      function (err, subs) {
        if (err) return cb(err);
        if (subs.length === 0 || options.method !== 'DEMAND_WATCH_SUBSCRIPTION') {
          return this(null, subs);
        }

        // Ensure access is allowed.
        var _this = _.after(subs.length, _.bind(function (err) {
          if (err) return this(err);
          subs = _.reject(subs, function (s) {
            return s.reject;
          });
          this(null, subs);
        }, this));
        _.each(subs, function (s) {
          db.inflate(s, {subscribee: {collection: s.meta.type, '*': 1}},
              function (err) {
            if (err) return _this(err);
            com.hasAccess(s.subscriber, s.subscribee, function (err, allow) {
              if (err) return _this(err);
              if (!allow) {
                s.reject = true;
              }
              _this();
            });
          });
        });
      },
      function (err, subs) {

        // Attach data to event.
        var data = com.client(_.extend(_.clone(event),
            {action: _.clone(params.data)}));

        // Publish event to creator.
        if (self.sio) {
          self.sio.sockets.in('usr-' + event.actor_id.toString())
              .emit('event.new', data);
        }

        // Publish event to subscribers.
        if (self.sio && event.public !== false) {
          _.each(subs, function (sub) {
            self.sio.sockets.in('usr-' + sub.subscriber._id.toString())
                .emit('event.new', data);
          });
        }

        // If notify, create a notification for each subscriber.
        if (subs.length === 0 || !params.notify
            || _.isEmpty(params.notify)) {
          return cb();
        }

        var _cb = _.after(subs.length, cb);
        _.each(subs, function (sub) {
          var __cb = _.after(_.size(params.notify), _cb);
          _.each(params.notify, function (v, k) {
            var recipient = sub[k];
            if (recipient._id.toString() === sub.subscriber._id.toString()
                && sub.subscriber._id.toString() === event.actor_id.toString()) {
              return;
            }

            // Create the notification.
            db.Notifications.create({
              subscriber_id: recipient._id,
              subscription_id: sub._id,
              event_id: event._id,
              read: false
            }, function (err, note) {
              if (err) return __cb(err);

              // Publish notification.
              note.event = event;
              if (self.sio) {
                self.sio.sockets.in('usr-' + recipient._id.toString())
                    .emit('notification.new', com.client(note));
              }

              // Handle notification delivery types by subscriber config.
              var notifications = recipient.config.notifications;
              var email = notifications[channel] && notifications[channel].email;
              if (self.mailer && (email === true || email === 'true')
                  && recipient.primaryEmail !== undefined
                  && recipient.primaryEmail !== '') {
                self.mailer.notify(recipient, note, params.data.body);
              }

              // Don't wait for mailer task.
              __cb();
            });
          });
        });
      }
    );
  });
}
