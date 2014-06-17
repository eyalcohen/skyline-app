/*
 * common.js: Common methods for resources and the page service.
 *
 */

// Module Dependencies
var crypto = require('crypto');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
exports.init = function (uri) { exports.ROOT_URI = uri; }

/*
 * Determine if user can access resource.
 */
var hasAccess = exports.hasAccess = function (user, resource, cb) {

  Step(
    function () {
      var next = this;

      // Walk up parents until have actual resource.
      (function _parent(err, doc) {
        if (err) return next(err);
        if (!doc.parent_id || !doc.parent_type) {
          return next(null, doc);
        }
        db[_.capitalize(doc.parent_type) + 's'].read({_id: doc.parent_id}, _parent);
      })(null, resource);

    }, function (err, resource) {
      if (err) return cb(err);

      // Get the resource author.
      var author_id = resource.author ? resource.author._id:
          resource.author_id;
      db.Users.read({_id: author_id}, this.parallel());

      // Look for a subscription.
      if (user) {
        db.Subscriptions.read({subscriber_id: user._id, subscribee_id: author_id,
            mute: false, 'meta.style': 'follow'}, this.parallel());
      }
    },
    function (err, author, sub) {
      if (err) return cb(err);
      if (!author || !author.config) {
        return cb('Could not find resource author');
      }

      // Check resource privacy.
      if (resource.public === false) {
        if (!user || user._id.toString() !== author._id.toString()) {
          return cb(null, false);
        }
      }

      // Check user privacy.
      if (!sub && author.config.privacy.mode.toString() === '1') {
        if (!user || user._id.toString() !== author._id.toString()) {
          return cb(null, false);
        }
      }

      cb(null, true);
    }
  );
}

/*
 * Error wrap JSON request.
 */
exports.error = function (err, req, res, data, estr) {
  if (typeof data === 'string') {
    estr = data;
    data = null;
  }
  var fn = req.xhr ? res.send: res.render;
  if (err || (!data && estr)) {
    var profile = {
      user: req.user,
      content: {page: null},
      root: exports.ROOT_URI,
      embed: req._parsedUrl.path.indexOf('/embed') === 0
    };
    if (err) {
      util.error(err);
      profile.error = {stack: err.stack};
      fn.call(res, 500, exports.client(profile));
    } else {
      profile.error = {message: estr + ' not found'};
      fn.call(res, 404, exports.client(profile));
    }
    return true;
  } else return false;
}

/*
 * Prepare obj for client.
 * - replace ObjectsIDs with strings.
 */
exports.client = function (obj) {
  var obj = _.clone(obj);
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  _.each(obj, function (att, n) {
    if (_.isObject(att) && att._id) {
      att.id = att._id.toString();
      delete att._id;
      exports.client(att);
    } else if (_.isObject(att) || _.isArray(att))
      exports.client(att);
  });
  return obj;
}

/*
 * Creates a string identifier.
 * @length Number
 */
exports.key = function (length) {
  length = length || 8;
  var key = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  return key;
}

/*
 * Make salt for a password.
 */
exports.salt = function () {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}

/*
 * Encrypt string.
 */
exports.encrypt = function (str, salt) { return crypto.createHmac('sha1', salt).update(str).digest('hex');
}

/*
 * Hash string.
 */
exports.hash = function (str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/*
 * Create a 32-bit identifier.
 */
exports.createId_32 = function () {
  return parseInt(Math.random() * 0x7fffffff);
}

/*
 * Remove ''s from an object.
 */
exports.removeEmptyStrings = function (obj) {
  _.each(obj, function (v, k) {
    if (_.isString(v) && v.trim() === '') {
      delete obj[k];
    }
  });
}

/*
 * Convert tag string to array.
 */
exports.tagify = function (str, delim) {
  var splitter = delim ? '[' + delim + ']': '[\W,_]';
  return !str ? []: _.chain(str.split(new RegExp(splitter)))
    .reject(function (t) { return t === ''; })
    .map(function (t) { return t.trim(); }).uniq().value();
},

/*
 * Index a document with redis.
 */
exports.index = function (client, group, doc, keys, cb) {
  cb = cb || function(){};
  if (keys.length === 0) return cb();
  var _cb = _.after(keys.length, cb);
  _.each(keys, function (k) {
    if (_.isArray(doc[k])) {
      var __cb = _.after(doc[k].length, _cb);
      _.each(doc[k], function (s) { _index(s, __cb); });
    } else _index(doc[k], _cb);
  });

  function _index(str, cb) {
    if (!_.isString(str)) return cb();
    str = _.humanize(str).match(/\w+/g);
    if (!str) return cb();
    str = str.join(' ').toLowerCase();
    if (str === '') return cb();
    // Redis key, score, string, callback
    client.zadd(group, 0, str + '::' + doc._id, cb);
  }
}
