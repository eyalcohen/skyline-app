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
    if (err) { cb(err); return; }
    if (!doc) { cb(new Error('Failed to find session.')); return; }
    else {
      var session = JSON.parse(doc.session);
      var userId = session.passport.user;
      if (userId) {
        self.findUserById(userId, function (err, user) {
          if (err) { cb(err); return; }
          if (!user) { cb(new Error('User and Session do NOT match!')); return; }
          delete user.openId;
          delete user._id;
          cb(null, user);
        });
      } else cb(new Error('Session has no User.'));
    }
  });
}


UserDb.prototype.getUserVehicleData = function (userId, cb) {
  var self = this;
  var data = {
    teams: [],
    fleets: [],
    vehicles: [],
  };

  Step(
    // Get user.
    function () {
      if ('number' === typeof userId)
        self.findUserById(userId, this);
      else return userId;
    },
    function (err, user) {
      if (err) { cb(err); return; }
      if (!user) { cb(new Error('Failed to find user.')); return; }
      _getVehicles(user, this);
    },
    // Get the user's teams.
    function (err, user) {
      var next = this;
      // Find teams that contain the user
      // or that contain the user's domain name
      var userDomain = user.emails[0].value.split('@')[1];
      self.collections.teams.find({ $or : [{ users : user._id },
            { domains : userDomain }] }).toArray(function (err, teams) {
        if (err) { next(err); return; }
        // Gather teams' vehicles and fleets.
        if (teams.length > 0) {
          var _next = _.after(teams.length, next);
          _.each(teams, function (team) {
            _getVehicles(team, true, function () {
              // Add teams to user data.
              delete team.vehicles;
              delete team.fleets;
              delete team.domains;
              delete team.users;
              delete team.admins;
              data.teams.push(team);
              _next.apply(this, arguments);
            });
          });
        } else return;
      });
    },
    // Fetch all the vehicles.
    function (err) {
      if (data.vehicles.length > 0) {
        var next = _.after(data.vehicles.length, this);
        _.each(data.vehicles, function (veh) {
          self.collections.vehicles.findOne({ _id: veh._id },
                                          function (err, vehicle) {
            if (err) { cb(err); return; }
            if (!vehicle) { cb(new Error('Failed to find vehicle.')); return; }
            delete vehicle._id;
            veh.doc = vehicle;
            next(null);
          });
        });
      } else return;
    },
    // All done.
    function (err) {
      cb(err, data);
    }
  );

  function _getVehicles(owner, isTeam, cb) {
    if ('function' === typeof isTeam) {
      cb = isTeam;
      isTeam = false;
    }
    // Get vehicles.
    _.each(owner.vehicles, function (access) {
      var veh = {
        _id: access.targetId,
        access: access,
      };
      if (isTeam) veh.teamId = owner._id;
      data.vehicles.push(veh);
    });
    // Get fleet vehicles.
    if (owner.fleets.length > 0) {
      var _cb = _.after(owner.fleets.length, cb);
      _.each(owner.fleets, function (access) {
        self.collections.fleets.findOne({ _id: access.targetId },
                                        function (err, fleet) {
          if (err) { cb(err); return; }
          if (!fleet) { cb(new Error('Failed to find fleet.')); return; }
          _.each(fleet.vehicles, function (vehicleId) {
            var veh = {
              _id: vehicleId,
              fleetId: fleet._id,
              access: access,
            };
            if (isTeam) veh.teamId = owner._id;
            data.vehicles.push(veh);
          });
          // Add fleets to user data only if
          // owner is the user and not a team.
          delete fleet.vehicles;
          if (!isTeam) data.fleets.push(fleet);
          cb(null, owner);
        });
      });
    } else cb(null, owner);
  }

}


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
  Step(
    function () {
      self.collections[granteeType]
          .findOne({ _id: Number(granteeId) }, this.parallel());
      self.collections[targetType]
          .findOne({ _id: Number(targetId) }, this.parallel());
    },
    function (err, grantee, target) {
      if (err) { cb(err); return; }
      if (!grantee) { cb(new Error('No grantee found.')); return; }
      if (!target) { cb(new Error('No target found.')); return; }
      grantee[targetType].push(opts);
      var update = {};
      update[targetType] = grantee[targetType];
      self.collections[granteeType].update({ _id: Number(granteeId) },
                                    { $set: update }, { safe: true },
                                    function (err) { cb(err); });
    }
  );
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





