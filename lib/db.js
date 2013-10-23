/*
 * db.js: MongoDB wrapper.
 *
 */

// Module dependencies.
var cluster = require('cluster');
var mongodb = require('mongodb');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var Step = require('step');
var oid = exports.oid = require('mongodb').BSONPure.ObjectID;

// Establish a db connection wrapper (constructor).
exports.Connection = function (uri, options, cb) {
  this.options = options;

  // Adds a collection to this db instance.
  this.add = function (name, conf, cb) {
    if (!this.db)
      return cb('Connect to a db instance before adding a collection');
    this.db.collection(name, function (err, col) {
      function _cb(err) { cb(err, col); }
      if (err) return _cb(err);
      exports[_.capitalize(col.collectionName) + 's'] = col;
      if (options.ensureIndexes && conf.indexes && conf.uniques
          && cluster.worker.id === 1) {
        util.log('Worker ' + cluster.worker.id + ': Ensuring `'
            + col.collectionName + '` collection indexes');
        col.dropAllIndexes(function () {
          var next = _.after(conf.indexes.length, _cb);
          _.each(conf.indexes, function (x, i) {
            col.ensureIndex(x, {
              unique: conf.uniques[i],
              sparse: conf.sparses ? conf.sparses[i]: false,
              dropDups: true
            }, next);
          });
        });
      } else _cb();
    });
  };

  // Connect
  mongodb.connect(uri, {server: {poolSize: 4}}, _.bind(function (err, db) {
    this.db = db;
    cb(err, this);
  }, this));
}

/*
 * Inflate (replace) +_ids with documents.
 */
var inflate = exports.inflate = function (docs, conf, cb) {
  var _cb;
  if (_.isArray(docs)) {
    if (docs.length === 0)
      return cb(null, docs);
    _cb = _.after(docs.length, cb);
    _.each(docs, handle);
  } else {
    _cb = cb;
    handle(docs);
  }
  function handle(doc) {
    var __cb = _.after(_.size(conf), _cb);
    _.each(conf, function (map, k) {
      var collection = exports[_.capitalize(map.collection) + 's'];
      var id = doc[k + '_id'];
      delete doc[k + '_id'];
      if (!id) {
        doc.missing ? doc.missing.push(k): doc.missing = [k];
        return __cb(null, docs);
      }
      collection.read({_id: id}, function (err, d) {
        if (err) return cb(err);
        if (!d) {
          doc[k] = 404;
          doc.missing ? doc.missing.push(k): doc.missing = [k];
          return __cb(null, docs);
        }
        doc[k] = {_id: d._id};
        _.each(map, function (val, att) {
          if (att === 'collection') return;
          doc[k][att] = typeof val === 'function' ? val(d): d[att];
        });
        __cb(null, docs);
      });
    });
  }
}

/*
 * Fill document +_id lists with corresponding documents.
 */
var fill = exports.fill = function (docs, source, key, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  var reverse = opts.reverse;
  delete opts.reverse;

  var collection = exports[source];
  if (!collection) return cb('Source collection not found');
  if (!_.isArray(docs)) docs = [docs];

  Step(
    function () {
      if (docs.length === 0) return this();
      var next = _.after(docs.length, this);
      _.each(docs, function (doc) {
        var query = {};
        query[key] = doc._id;
        Step(
          function () {
            collection.list(query, _.clone(opts), this.parallel());
            collection.count(query, this.parallel());
          },
          function (err, list, count) {
            if (err) return cb(err);
            doc[source.toLowerCase()] = reverse ? list.reverse(): list;
            doc[source.toLowerCase() + '_cnt'] = count;
            next();  
          }
        );
      });
    },
    function (err) {
      cb(err, _.isArray(docs) ? docs: _.first(docs));
    }
  );

}

/*
 * Insert a document adding `created` and `updated` keys if
 * they doesn't exist in the given props.
 */
mongodb.Collection.prototype.create = function (props, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  if (!opts) opts = {};
  var _inflate = opts.inflate;
  delete opts.inflate;
  var _force = opts.force;
  delete opts.force;
  if (!props.created)
    props.created = new Date;
  if (!props.updated)
    props.updated = new Date;

  var attempt = 1;
  (function insert() {
    this.insert(props, opts, _.bind(function (err, ins) {
      if (err && err.code === 11000) {
        var m = err.err.match(/\$([a-z]+)_1/);
        var k = m ? m[1]: null
        if (!k || !_force || !_force[k]) return cb(err);
        props[k] += attempt;
        ++attempt;
        return insert.call(this);
      }
      if (err) return cb(err);
      var doc = ins[0];
      if (_inflate && cb) {
        inflate(doc, _inflate, function (err, doc) {
          if (err) return cb(err);
          cb(null, doc.missing ? undefined: doc);
        });
      } else if (cb) cb(null, doc);
    }, this));
  }).call(this);
}

/*
 * Get a document by query.
 */
mongodb.Collection.prototype.read = function (query, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }

  var _inflate = opts.inflate;
  delete opts.inflate;
  var _inc = opts.inc;
  delete opts.inc;

  this.findOne(query, _.bind(function (err, doc) {
    if (err || !doc) return cb(err, doc);
    if (_inflate) {
      inflate(doc, _inflate, function (err, doc) {
        if (err) return cb(err);
        cb(null, doc.missing ? undefined: doc);
      });
    } else cb(null, doc);
    if (_inc)
      this._update(query, {$inc: {vcnt: 1}}, function (err) {
        if (err) util.error(err);
      });
  }, this));
}

/*
 * Update a document by query with the given props.
 */
mongodb.Collection.prototype._update = mongodb.Collection.prototype.update;
mongodb.Collection.prototype.update = function (query, props, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  if (!opts) opts = {};
  var _force = opts.force;
  delete opts.force;

  props.$set = props.$set || {};
  props.$set.updated = new Date;
  var attempt = 1;
  (function update() {
    this._update(query, props, opts, _.bind(function (err, stat) {
      if (err && err.code === 11001) {
        var k = err.err.match(/\$([a-zA-Z]+)_1/)[1];
        if (!_force || !_force[k]) return cb(err);
        props.$set[k] += attempt;
        ++attempt;
        return update.call(this);
      }
      cb(err, stat);
    }, this));
  }).call(this);
}

/*
 * Delete a document by query.
 */
mongodb.Collection.prototype.delete = function (query, cb) {
  this.remove(query, cb);
}

/*
 * Determine if a doc exists with a specified
 * key/val pair for the collection.
 */
mongodb.Collection.prototype.available = function (query, cb) {
  this.findOne(query, function (err, doc) {
    if (err) return cb(err);
    cb(err, !doc);
  });
}

/*
 * List documents and optionally
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
mongodb.Collection.prototype.list = function (query, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }

  var _inflate = opts.inflate;
  delete opts.inflate;
  var _inc = opts.inc;
  delete opts.inc;

  this.find(query, opts).toArray(_.bind(function (err, docs) {
    if (err) return cb(err);
    if (!_inflate)
      cb(null, docs);
    else
      inflate(docs, _inflate, function (err, docs) {
        if (err) return cb(err);
        cb(null, _.reject(docs, function (doc) {
          return doc.missing;
        }));
      });
    if (_inc)
      _.each(docs, _.bind(function (d) {
        this._update({_id: d._id}, {$inc: {vcnt: 1}}, function (err) {
          if (err) util.error(err);
        });
      }, this));
  }, this));
}
