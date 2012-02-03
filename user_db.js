// Functionality for handling users, fleets, and classes.

/** Notes:
 *
 * User, Teams, Vehicles, and Fleets all have non-standard _id's:
 *
 *   _id = parseInt(Math.random() * 0x7fffffff);
 * 
 * This means we do not need to create new ObjectIDs
 * when looking for these documents by _id.
 */ 

// var ObjectID = require('mongodb').BSONPure.ObjectID;
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
      _.each(['sessions', 'users', 'teams', 'vehicles', 'fleets'],
            function (colName) {
        db.collection(colName, group());
      });
    },
    function (err, cols) {
      if (err) { cb(err); return; }      
      _.each(cols, function (col) {
        self.collections[col.collectionName] = col;
      });
      cb(null, self);
    }
    // TODO: indexes!
  );
}


// find

UserDb.prototype.findUserById = function (id, cb) {
  this.collections.users.findOne({ _id: Number(id) },
                                function (err, user) {
    cb(err, user);
  });
}

UserDb.prototype.findSessionUserById = function (id, cb) {
  var self = this;
  self.collections.sessions.findOne({ _id: id },
                                function (err, doc) {
    if (err || !doc) cb(err);
    else {
      var session = JSON.parse(doc.session);
      var userId = session.passport.user;
      if (userId) {
        self.findUserById(userId, function (err, user) {
          if (user) {
            delete user.openId;
            delete user._id;
            cb(err, user);
          } else cb(new Error('User and Session do NOT match!'))
        });
      } else cb(new Error('Session has no User.'));
    }
  });
}


UserDb.prototype.getUserVehicleList = function (userId, cb) {
  var self = this;
  var vehicleIds = [];
  var vehicles = [];

  Step(
    function getUser() {
      self.findUserById(userId, this());
    },
    function getTeamVehicles(err, user) {
      // Find teams that contain the user
      // or that contain the user's domain name
      var userDomain = user.emails[0].value.split('@')[1];
      self.collections.teams.find({ $or : [{ users : user._id },
            { domains : userDomain }] }).toArray(function (err, teams) {
        var fleetIds = [];
        // Collect _ids.
        _.each(teams, function (team) {
          vehicleIds.concat(team.vehicles);
          fleetIds.concat(team.fleets);
        });
        // Get all the fleets' vehicles.
        _.uniq(fleetIds);
        _.each(fleetIds, function (fleetId) {
          self.collections.fleets.findOne({ id: fleetId },
                                          function (err, fleet) {
            
          });
        });
        
      });
    }
  );

}


// UserDb.prototype.populateUserVehicles = function (user, cb) {
//   var self = this;
//   if (user.vehiclesPopulated) {
//     cb(null);
//     return;
//   }
//   _.after(user.vehicles.length, cb);
//   _.each(user.vehicles, function (access) {
//     self.collections.vehicles.findOne({ _id: access.targetId },
//                                       function (err, veh) {
//       access.target = veh;
//       cb(err);
//     });
//   });
// }


// create

UserDb.prototype.findOrCreateUserFromOpenId = function (props, cb) {
  var users = this.collections.users;
  users.findOne({ openId: props.openId },
                function (err, user) {
    if (err) { cb(err); return; }
    if (!user)
      createUniqueId_32(users, function (err, id) {
        if (err) { cb(err); return; }
        _.extend(props, {
          _id: id,
          created: Date.now(),
          vehicles: [],
          fleets: [],
        });
        users.insert(props, { safe: true },
                    function (err, inserted) {
          cb(err, inserted[0]);
        });
      });
    else cb(null, user);
  });
}

UserDb.prototype.createTeam = function (props, cb) {
  createDoc.call(this, this.collections.teams, props, cb)
}

UserDb.prototype.createVehicle = function (props, cb) {
  createDoc.call(this, this.collections.vehicles, props, cb)
}

UserDb.prototype.createFleet = function (props, cb) {
  createDoc.call(this, this.collections.fleets, props, cb)
}



// edit

UserDb.prototype.addAccess = function (ids, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var granteeId = ids.userId || ids.teamId;
  var targetId = ids.vehicleId || ids.fleetId;
  var granteeType = ids.userId ? 'users' : 'teams';
  var targetType = ids.vehicleId ? 'vehicles' : 'fleets';
  _.defaults(opts, {
    admin: false,
    config: false,
    channels: ['/'],
  });
  opts.targetId = targetId;
  self.collections[granteeType].findOne({ _id: Number(granteeId) },
                                function (err, grantee) {
    if (err) { cb(err); return; }
    if (!grantee) { cb(new Error('No grantee found.')); return; }
    grantee[targetType].push(opts);
    var update = {};
    update[targetType] = grantee[targetType];
    self.collections[granteeType].update({ _id: Number(granteeId) },
                                  { $set: update }, { safe: true },
                                  function (err) {
      cb(err);
    });
  });
}


// util

function createUniqueId_32(collection, cb) {
  var id = parseInt(Math.random() * 0x7fffffff);
  collection.findOne({ _id: id }, function (err, doc) {
    if (err) { cb(err); return; }
    if (doc) createUniqueId_32(collection, cb);
    else cb(null, id);
  });
}

function createDoc(collection, props, cb) {
  var self = this;
  createUniqueId_32(collection, function (err, id) {
    if (err) { cb(err); return; }
    _.extend(props, {
      _id: id,
      created: Date.now(),
    });
    collection.insert(props, { safe: true },
                      function (err, inserted) {
      cb(err, inserted[0]);
    });
  });
}





