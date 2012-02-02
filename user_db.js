// Functionality for handling users, fleets, and classes.

/** Notes:
 *
 * Vehicles, vclasses, and fleets all have non-standard _id's
 *
 *   _id = parseInt(Math.random() * 0x7fffffff);
 * 
 * This means we do not need to create a new ObjectID
 * when finding these documents by _id.
 */ 

var ObjectID = require('mongodb').BSONPure.ObjectID;
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');


var UserDb = exports.UserDb = function (db, options, cb) {
  var self = this;
  self.db = db;

  self.collections = {};

  Step(
    function () {
      var group = this.group();
      _.each(['sessions', 'users', 'vehicles', 'vclasses'], function (colName) {
        db.collection(colName, group());
      });
    },
    function (err, cols) {
      if (err) this(err);
      else {
        _.each(cols, function (col) {
          self.collections[col.collectionName] = col;
        });
        cb(err, self);
      }
    }
    // TODO: indexes!
  );
}


// find

UserDb.prototype.findUserByHexStr = function (str, cb) {
  this.collections.users.findOne({ _id: new ObjectID(str) },
                                function (err, user) {
    cb(err, user);
  });
}

UserDb.prototype.findSessionUserById = function (id, cb) {
  var self = this;
  self.collections.sessions.findOne({ _id: id },
                                function (err, doc) {
    if (err || !doc)
      cb(err);
    else
      self.findUserByHexStr(JSON.parse(doc.session).passport.user,
                            function (err, user) {
        delete user.openId;
        delete user._id;
        cb(err, user);
      });
  });
}

UserDb.prototype.populateUserVehicles = function (user, cb) {
  var self = this;
  if (user.vehiclesPopulated) {
    cb(null);
    return;
  }
  _.after(user.vehicles.length, cb);
  _.each(user.vehicles, function (access) {
    self.collections.vehicles.findOne({ _id: access.targetId },
                                      function (err, veh) {
      access.target = veh;
      cb(err);
    });
  });
}


// create

UserDb.prototype.findOrCreateUserFromOpenId = function (props, cb) {
  var users = this.collections.users;
  users.findOne({ openId: props.openId },
                function (err, user) {
    if (!user) {
      _.extend(props, {
        created: Date.now(),
        admin: true,
        vehicles: [],
        fleets: [],
        vclasses: [],
      });
      users.insert(props, { safe: true },
                  function (err, inserted) {
        cb(err, inserted[0])
      });
    } else cb(err, user);
  });
}

UserDb.prototype.createVehicle = function (props, cb) {
  this.collections.vehicles.insert(props, { safe: true },
                                  function (err, inserted) {
    cb(err, inserted[0])
  });
}

UserDb.prototype.findOrCreateVClassFromTitle = function (title, cb) {
  var vclasses = this.collections.vclasses;
  vclasses.findOne({ title: title },
                    function (err, vclass) {
    if (!vclass) {
      var props = {
        _id: parseInt(Math.random() * 0x7fffffff),
        title: title,
        created: Date.now(),
      };
      vclasses.insert(props, { safe: true },
                      function (err, inserted) {
        cb(err, inserted[0])
      });
    } else cb(err, vclass);
  });
}


// edit

UserDb.prototype.addAccess = function (targetId, userId, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var type = opts.type || 'vehicles';
  delete opts.type;
  _.defaults(opts, {
    admin: false,
    config: false,
    channels: ['/'],
  });
  opts.targetId = targetId;
  self.collections.users.findOne({ _id: userId },
                                function (err, user) {
    if (err) { cb(err); return; }
    user[type].push(opts);
    var update = {};
    update[type] = user[type];
    self.collections.users.update({ _id: userId },
                                  { $set: update }, { safe: true },
                                  function (err) {
      cb(err);
    });
  });
}

// User Model:
// 
// user: {
// 
//     _id: ObjectId, -- unique identifier
//     email: String, -- for login
//     pass: String, -- for login
//     salt: String, -- for login
//     name: { -- split for indexing
//         first: String,
//         last: String,
//     },
//     created: Date, -- could be useful
//     vehicles: [ Access ], -- access object list describing vehicles (see below)
//     fleets: [ Access ], -- access object list describing fleets
//     vclasses: [ Access ], -- access object list describing vclasses
// }
// 
// Vehicle Model:
// 
// vehicle: {
//     _id: ObjectId, -- unique identifier
//     title: String, -- e.g. “2011 Chevy Volt”
//     description: String, -- e.g. “Mike’s city commuter” - or nickname, Zipcar style, e.g. “White Lightning”
//     created: Date, -- could be useful
//     vclassId: ObjectId, -- a vehicle can belong to one vclass only, e.g. “Volts”
// }
// 
// fleet: {
//     _id: ObjectId, -- unique identifier
//     title: String, -- e.g. “Oakland Car Share”
//     description: String, -- e.g. “Compact cars shared in Oakland” - or nickname, Zipcar style, e.g. “The Raiders”
//     created: Date, -- could be useful
//     vehicles: [ ObjectId ], -- list of vehicles belonging to fleet
// }
// 
// vclass: {
//     _id: ObjectId, -- unique identifier
//     title: String, -- e.g. “Monarch”
//     description: String, -- e.g. “Hybrid excavators” NOT USED
//     created: Date, -- could be useful
// }
// 
// Access Object (not a db collection just schema):
// 
// access: {
//     _id: ObjectId, -- vehicle, fleet, or vclass
//     admin: Boolean, -- edit info and users
//     config: Boolean, -- edit config files / data
//     geo: Boolean, -- view location data
//     (etc.)
// }










