// Functionality for handling users, fleets, and classes.

/** Notes:
 *
 * User, Teams, Vehicles, and Fleets all have non-standard _id's:
 *
 *   _id = createUniqueId_32()
 * 
 * This means we do not need to create new ObjectIDs
 * when looking for these documents by _id.
 */

var crypto = require('crypto');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');


/*
 * Creates a db instance.
 */
var UserDb = exports.UserDb = function (db, options, cb) {
  var self = this;
  self.db = db;
  self.collections = {};

  var collections = {
    users: { indexes: [
      { created: 1, primaryEmail: 1 },  // For displaying list?
      { primaryEmail: 1 },  // For finding user by primaryEmail.
    ] },
    teams: { indexes: [ { created: 1 } ] },
    vehicles: { indexes: [ { created: 1 } ] },
    fleets: { indexes: [ { created: 1 } ] },
    links: { indexes: [ { created: 1, key: 1 } ] },
  };

  Step(
    function () {
      var group = this.group();
      _.each(collections, function (k, name) {
        db.collection(name, group());
      });
    },
    function (err, cols) {
      if (err) return this(err);
      _.each(cols, function (col) {
        self.collections[col.collectionName] = col;
      });
      if (options.ensureIndexes) {
        var parallel = this.parallel;
        _.each(cols, function (col) {
          (collections[col.collectionName].indexes || []).forEach(function(i) {
            col.ensureIndex(i, parallel());
          });
        });
      } else this();
    },
    function (err) {
      cb(err, self);
    }
  );
}


/*
 * Finds a user by its primaryEmail. If it does not exist
 * create one using the given props.
 */
UserDb.prototype.findOrCreateUserFromPrimaryEmail =
    function (props, cb) {
  var users = this.collections.users;
  if (!props.primaryEmail)
    if (props.emails)
      props.primaryEmail = props.emails[0].value;
    else return cb(new Error('User profile missing email address'));
  if (props.password) {
    props.salt = makeSalt();
    props.password = encryptPassword(props.password, props.salt);
  }
  users.findOne({ primaryEmail: props.primaryEmail },
                function (err, user) {
    if (err) return cb(err);
    if (!user)
      createUniqueId_32(users, function (err, id) {
        if (err) return cb(err);
        _.extend(props, {
          _id: id,
          pin: makeUserPin(),
          created: new Date,
          vehicles: [],
          fleets: [],
        });
        users.insert(props, { safe: true },
                    function (err, inserted) {
          if (err) return cb(err);
          cb(null, inserted[0]);
        });
      });
    else cb(null, user);
  });
}


/*
 * Create methods for vehicles, fleets, and teams.
 */
UserDb.prototype.createVehicle = function (props, cb) {
  _.defaults(props, {
    title: null,
    description: null,
    nickname: null,
    clientId: createId_32(),
  });
  createDoc.call(this, this.collections.vehicles, props, cb);
}
UserDb.prototype.createFleet = function (props, cb) {
  _.defaults(props, {
    title: null,
    description: null,
    nickname: null,
    vehicles: [],
  });
  _.uniq(props.vehicles);
  createDoc.call(this, this.collections.fleets, props, cb);
}
UserDb.prototype.createTeam = function (props, cb) {
  _.defaults(props, {
    title: null,
    description: null,
    nickname: null,
    domains: [],
    users: [],
    admins: [],
    vehicles: [],
    fleets: [],
  });
  _.uniq(props.domains);
  _.uniq(props.users);
  _.uniq(props.admins);
  createDoc.call(this, this.collections.teams, props, cb);
}
UserDb.prototype.createLink = function (props, cb) {
  var self = this;
  (function create() {
    var key = makeURLKey(8);
    self.collections.links.findOne({ key: key },
                                  function (err, doc) {
      if (err) return cb(err);
      if (!doc) {
        props.key = key;
        createDoc.call(self, self.collections.links, props, cb);
      } else create();
    });
  })();
}


/*
 * Finds a user by its _id.
 */
UserDb.prototype.findUserById = function (id, cb) {
  this.collections.users.findOne({ _id: Number(id) },
                                function (err, user) {
    cb(err, user);
  });
}


/*
 * Collect all vehicles accessible by user.
 * If a vehicle is accessed through a fleet or team,
 * it will contain a fleetId and / or teamId.
 * Those fleets and / or teams will be listed in the
 * returned object in addition to all the vehicles...
 * the team or fleet info can then be looked up in those
 * lists by _id.
 *
 * Returns:
 *   {
 *     teams: [...],
 *     fleets: [...],
 *     vehicles: [...],
 *   };
 */
UserDb.prototype.getUserVehicleData = function (userId, cb) {
  var self = this;
  var data = {
    teams: [],
    fleets: [],
    vehicles: [],
  };

  /*
   * Get the given owner's (user or team) vehicles and fleets.
   */
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
      push(veh);
    });
    // Get fleet vehicles.
    if (owner.fleets.length > 0) {
      var _cb = _.after(owner.fleets.length, cb);
      _.each(owner.fleets, function (access) {
        self.collections.fleets.findOne({ _id: access.targetId },
                                        function (err, fleet) {
          if (err) return cb(err);
          if (!fleet) return cb(new Error('Failed to find fleet.'));
          _.each(fleet.vehicles, function (vehicleId) {
            var veh = {
              _id: vehicleId,
              fleetId: fleet._id,
              access: access,
            };
            if (isTeam) veh.teamId = owner._id;
            push(veh);
          });
          // Add fleets to user data only if
          // owner is the user and not a team.
          // * edit: currently, team fleets are also added
          // * becuase we are not building a heirachecal list
          // * on the client-side... nesting does not make sense.
          delete fleet.vehicles;
          // if (!isTeam) 
            data.fleets.push(fleet);
          _cb(null, owner);
        });
      });
    } else cb(null, owner);
  }

  /*
   * Push a vehicle list object into user data
   * or update an existing one with lower permissions.
   */
  function push(vehicle) {
    var dup = _.find(data.vehicles, function (veh) {
      return vehicle._id === veh._id;
    });
    if (dup) {
      _.each(vehicle.access, function (val, key) {
        // TODO: add handling for channels or other types
        // of keys in case they're added in the future.
        if (val === true) dup.access[key] = val;
      });
    } else data.vehicles.push(vehicle);
  }

  // Scrape for user's vehicles.
  Step(
    // Get user.
    function () {
      if ('number' === typeof userId)
        self.findUserById(userId, this);
      else return userId;
    },
    // Get user's vehicles and fleets.
    function (err, user) {
      if (err) return cb(err);
      if (!user) return cb(new Error('Failed to find user.'));
      _getVehicles(user, this);
    },
    // Get the user's teams.
    function (err, user) {
      var next = this;
      // Find teams that contain the user
      // or that contain a user domain name.
      var userDomains = _.map(user.emails, function (email) {
        return email.value.split('@')[1];
      });
      self.collections.teams.find({ $or : [{ users : user._id },
            { domains: { $in : userDomains } }] }).toArray(function (err, teams) {
        if (err) return next(err);
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
        } else next();
      });
    },
    // Fetch all the vehicles.
    function (err) {
      var next = this;
      if (data.vehicles.length > 0) {
        var _next = _.after(data.vehicles.length, next);
        _.each(data.vehicles, function (veh) {
          self.collections.vehicles.findOne({ _id: veh._id },
                                          function (err, vehicle) {
            if (err) return cb(err);
            if (!vehicle) return cb(new Error('Failed to find vehicle.'));
            delete vehicle._id;
            veh.doc = vehicle;
            _next();
          });
        });
      } else next();
    },
    // All done.
    function (err) {
      cb(err, data);
    }
  );
}


/*
 * Adds an access object for the given
 * `target` - either a vehicle or fleet to the given
 * `grantee` - either a user or a team.
 *
 * Default Access:
 *   {
 *     created: new Date,
 *     // lastAccess: null, -- not used... could reconsider, but it's very
 *                             hard to update this value in practice
 *     admin: false, -- manage other users.
 *     config: false, -- edit vehicle config files
 *     insert: false, -- insert sample
 *     note: false, -- add comments
 *     chans: ['/'], -- access specific channels (currently IGNORED)
 *  }
 */
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
    created: new Date,
    // lastAccess: null,
    admin: false,
    config: false,
    insert: false,
    note: false,
    chans: ['/'],
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
      if (err) return cb(err);
      if (!grantee) return cb(new Error('No grantee found.'));
      if (!target) return cb(new Error('No target found.'));
      // This might need some more thought.
      // If access already exists for this grantee
      // on this target, we replace it with the new one.
      // Consider the case where a user's access is down/upgraded...
      var dup = _.find(grantee[targetType], function (acc) {
        return opts.targetId === acc.targetId;
      });
      if (dup)
        grantee[targetType][grantee[targetType].indexOf(dup)] = opts;
      else grantee[targetType].push(opts);
      var update = {};
      update[targetType] = grantee[targetType];
      self.collections[granteeType].update({ _id: Number(granteeId) },
                                          { $set: update }, { safe: true }, cb);
    }
  );
}


/*
 * Determine whether or not user has access read
 * to a vehicle. This will be true simply if the vehicle
 * exists in the given vehicles list.
 * Specify a list of keys to check access
 * on a specific (combination of) flag(s).
 *
 *   haveAccess(vehicle._id, ['admin', 'config'])
 */
UserDb.haveAccess = function (vehicleId, vehicles, accessKeys) {
  if (accessKeys && accessKeys.length === 0)
    accessKeys = null;
  var allow = false;
  var vehicle = _.find(vehicles, function (veh) {
    return veh._id === vehicleId;
  });
  if (vehicle && accessKeys) {
    var allow = true;
    _.each(accessKeys, function (k) {
      if (!vehicle.access[k])
        allow = false;
      // TODO: check for strings in lists (channels)
      // or other types of access schemes that
      // don't exist yet.
    });
  } else if (vehicle) allow = true;
  return allow;
}


/*
 * Determine whether or not the given string is
 * the user's actual password.
 */
UserDb.authenticateLocalUser = function (user, str) {
  return encryptPassword(str, user.salt) === user.password;
}


/*
 * Inserts a document into a collecting
 * adding `_id` and `created` keys if they
 * don't exist in the given props.
 */
function createDoc(collection, props, cb) {
  var self = this;
  function insert() {
    collection.insert(props, { safe: true },
                      function (err, inserted) {
      if (err) return cb(err);
      cb(null, inserted[0]);
    });
  }
  if (!props.created) 
    props.created = new Date;
  if (!props._id) {
    createUniqueId_32(collection, function (err, id) {
      if (err) return cb(err);
      props._id = id;
      insert();
    });
  } else insert();  
}


/*
 * Make some random salt for a password.
 */
function makeSalt() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}


/*
 * Make some random salt for a password.
 */
function encryptPassword(password, salt) {
  return crypto.createHmac('sha1', salt)
               .update(password)
               .digest('hex');
}


/*
 * Create a 32-bit identifier.
 */
function createId_32() {
  return parseInt(Math.random() * 0x7fffffff);
}


/*
 * Create a 32-bit identifier for a
 * document ensuring that it's unique
 * for the given collection.
 */
function createUniqueId_32(collection, cb) {
  var id = createId_32();
  collection.findOne({ _id: id }, function (err, doc) {
    if (err) return cb(err);
    if (doc) createUniqueId_32(collection, cb);
    else cb(null, id);
  });
}


/**
  * Create a pin of length 4.
  * (Using an actual number limits the
  * possible value to > 1000)
  */
function makeUserPin() {
  var pin = '';
  var possible = '0123456789';
  for (var i = 0; i < 4; ++i)
    pin += possible.charAt(Math.floor(
          Math.random() * possible.length));
  return pin;
}


/**
  * Create a string identifier
  * for use in a URL at a given length.
  */
function makeURLKey(length) {
  var key = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
      'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(
          Math.random() * possible.length));
  return key;
}

