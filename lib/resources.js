/*
 * resources.js: Handling for resource routing.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var com = require('./common.js');

// Resource collections.
exports.collections = {
  user: {
    resource: true,
    indexes: [{primaryEmail: 1}, {username: 1}, {role: 1}],
    uniques: [false, true, false]
  },
  dataset: {
    resource: true,
    indexes: [{author_id: 1}],
    uniques: [false]
  },
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
};

// Prepare resources.
exports.init = function (app, cb) {

  // Add resource collections, routes, and jobs.
  var _cb = _.after(_.size(exports.collections), cb);
  _.each(exports.collections, function (conf, name) {
    app.get('connection').add(name, conf, function (err) {
      if (err) return _cb(err);
      if (conf.resource)
        require('./resources/' + name).init(app).routes(app).jobs(app);
      _cb();
    });
  });

}
