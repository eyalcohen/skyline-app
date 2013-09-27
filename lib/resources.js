/*
 * resources.js: Handling for resource routing.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var com = require('./common');

// Resource collections.
exports.collections = {
  user: {
    resource: true,
    indexes: [{primaryEmail: 1}, {username: 1}, {role: 1}],
    uniques: [true, true, false],
    sparses: [true, false, false]
  },
  dataset: {
    resource: true,
    indexes: [{author_id: 1}],
    uniques: [false]
  },
  view: {
    resource: true,
    indexes: [{author_id: 1, slug: 1}],
    uniques: [false, true]
  },
  subscription: {
    indexes: [{subscriber_id: 1, subscribee_id: 1}, {type: 1}],
    uniques: [true, false]
  },
  event: {
    indexes: [{actor_id: 1}, {target_id: 1}],
    uniques: [false, false]
  },
  notification: {
    resource: true,
    indexes: [{subscriber_id: 1}, {read: 1}],
    uniques: [false, false]
  },
  key: {}
};

// Resource profiles for client objects.
exports.profiles = {
  user: {
    collection: 'user',
    username: 1,
    role: 1,
    displayName: 1,
    gravatar: function (d) {
      return com.hash(d.primaryEmail || 'foo@bar.baz');
    }
  },
  dataset: {
    collection: 'dataset',
    title: 1
  },
  event: {
    collection: 'event',
    data: 1,
  },
};

// Prepare resources.
exports.init = function (app, cb) {

  // Add resource collections, routes, and jobs.
  var _cb = _.after(_.size(exports.collections), cb);
  _.each(exports.collections, function (conf, name) {
    (app.settings ? app.get('connection'): app.connection)
        .add(name, conf, function (err) {
      if (err) return _cb(err);
      if (app.settings && conf.resource) {
        var res = require('./resources/' + name);
        res.init(app).routes(app);
        if (app.get('SCHEDULE_JOBS')) res.jobs(app);
      }
      _cb();
    });
  });

}
