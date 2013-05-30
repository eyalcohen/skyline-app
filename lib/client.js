/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

function shortInpsect(argList, maxChars) {
  var s = _.map(argList, function (arg) {
    if (_.isUndefined(arg))
      return 'undefined';
    else if (_.isFunction(arg))
      return '[Function]';
    else
      return JSON.stringify(arg);
  }).join(', ');
  if (s.length > maxChars) {
    s = s.substr(0, maxChars - 3);
    s += '...';
  }
  return s;
}

function dnodeLogMiddleware(remote, client) {
  var self = this;
  var maxArgsChars = 160, maxResultsChars = 40;
  Object.keys(self).forEach(function (fname) {
    var f = self[fname];
    if (!_.isFunction(f)) return;
    self[fname] = function () {
      var fnamePretty = color.red('dnode') + ' ' + color.yellow(fname);
      var funcArgs = _.toArray(arguments);
      var start = Date.now();
      var callback = funcArgs[funcArgs.length - 1];
      if (_.isFunction(callback)) {
        var waiting = setInterval(function () {
          util.log(fnamePretty + '(' +
              color.underline(shortInpsect(funcArgs, maxArgsChars)) +
              '): no callback after', Date.now() - start, 'ms!!!');
        }, 1000);
        funcArgs[funcArgs.length - 1] = function () {
          clearInterval(waiting);
          util.log(fnamePretty + '(' +
              color.underline(shortInpsect(funcArgs, maxArgsChars)) +
              ') -> (' +
              color.underline(shortInpsect(arguments, maxResultsChars)) +
              ')', Date.now() - start, 'ms');
          callback.apply(this, arguments);
        };
        f.apply(this, funcArgs);
      } else {
        var start = Date.now();
        f.apply(this, funcArgs);
        util.log(fnamePretty + '(' +
            color.underline(shortInpsect(funcArgs, maxArgsChars)) + ')',
            Date.now() - start, 'ms');
      }
    };
  });
}

function ExecutionQueue(maxInFlight) {
  var inFlight = 0;
  var queue = [];
  function done() {
    --inFlight;
    while (queue.length && inFlight < maxInFlight) {
      var f = queue.shift();
      ++inFlight;
      f(done);
    }
  }
  return function (f) {
    if (inFlight < maxInFlight) {
      ++inFlight;
      f(done);
    } else
      queue.push(f);
  };
}

var Client = exports.Client = function (socket, userDb, sampleDb) {
  this.socket = socket;
  this.userDb = userDb;
  this.sampleDb = sampleDb;

  // Handles currently being delivered to client (vehicleId, channelName).
  this.subscriptions = {};

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);
}


Client.prototype.authorize = function (cb) {

  // var userId = req.session.passport.user;
  // if (userId) {
  //   userDb.findUserById(userId, function (err, user) {
  //     if (err) return cb(err.toString());
  //     if (!user)
  //       return cb('User and Session do NOT match!');
  //     delete user.password;
  //     delete user.salt;
  //     delete user.pin;
  //     userDb.getUserVehicleData(user, function (err, data) {
  //       if (err) return cb(err.toString());
  //       delete user.vehicles;
  //       delete user.fleets;
  //       user.data = {
  //         teams: data.teams,
  //         fleets: data.fleets,
  //       };
  //       req.user = user;
  //       req.user.data.vehicles = data.vehicles;
  //       cb(null, user);
  //     });
  //   });
  // } else cb('Session has no User.');
}

// var client = function () {

//   // This will be the initial http request seen by connect.
//   // var req;

//   // Handles currently being delivered to client (vehicleId, channelName).
//   var subscriptions = {};

//   // Mostly serialize fetch operations - doing a bunch in parallel is
//   // mysteriously slower than serially, and there's nothing to be gained by
//   // making requests delay each other.
//   var sampleDbExecutionQueue = ExecutionQueue(2);

//   // conn.on('ready', function () {
//   //   var sockId = conn.stream.socketio.id;
//   //   req = conn.stream.socketio.manager.handshaken[sockId];
//   // });

//   // conn.on('end', function () {
//   //   _.keys(subscriptions).forEach(cancelSubscribeSamples);
//   // });

//   function authorize(cb) {
//     // If we've gotten this far, the session
//     // is valid and has already been fetched.
//     // Now we see if there's a user attached.
//     var userId = req.session.passport.user;
//     if (userId) {
//       userDb.findUserById(userId, function (err, user) {
//         if (err) return cb(err.toString());
//         if (!user)
//           return cb('User and Session do NOT match!');
//         delete user.password;
//         delete user.salt;
//         delete user.pin;
//         userDb.getUserVehicleData(user, function (err, data) {
//           if (err) return cb(err.toString());
//           delete user.vehicles;
//           delete user.fleets;
//           user.data = {
//             teams: data.teams,
//             fleets: data.fleets,
//           };
//           req.user = user;
//           req.user.data.vehicles = data.vehicles;
//           cb(null, user);
//         });
//       });
//     } else cb('Session has no User.');
//   }

//   /*
//    * Wrapper for remote accesible methods.
//    * Flags is a list if specific access keys
//    * to enforce.
//    */
//   function ensureAuth(f, flags) {
//     return function () {
//       var args = _.toArray(arguments);
//       var vid = _.first(args);
//       var cb = _.last(args);
//       if (!UserDb.haveAccess(vid, req.user.data.vehicles, flags))
//         return cb('Permission denied.');
//       else f.apply(null, args);
//     };
//   }

//   //// Fetch colletion methods ////
//   // Since these are read methods and
//   // we maintain a copy of the user's 
//   // data server-side that was created against
//   // their access lists, we do not need to re-auth
//   // on those specific vehicles unless we're fetching
//   // events for a specific client-side defined vehicle.

//   function fetchVehicles(cb) {
//     if (req.user.data.vehicles.length === 0)
//       return cb(null, []);
//     var _done = _.after(req.user.data.vehicles.length, done);
//     _.each(req.user.data.vehicles, function (veh) {
//       sampleDb.fetchSamples(veh._id, '_wake', {},
//                             function (err, cycles) {
//         if (err) return cb(err);
//         if (cycles && cycles.length > 0)
//           veh.lastCycle = _.last(cycles);
//         else veh.lastCycle = { beg: 0, end: 0 };
//         _done();
//       });
//     });

//     function done() {
//       cb(null, req.user.data.vehicles.sort(function (a, b) {
//         return b.lastCycle.end - a.lastCycle.end;
//       }));
//     }
//   }

//   function fetchEvents(opts, cb) {
//     if (_.isFunction(opts)) {
//       cb = opts;
//       opts = null;
//     }
//     var vehicles;
//     if (opts && opts.vehicleId) {
//       if (UserDb.haveAccess(opts.vehicleId, req.user.data.vehicles))
//         vehicles = [{ _id: opts.vehicleId }];
//       else return cb('Permission denied.');
//     } else vehicles = req.user.data.vehicles;
//     var drives = [];
//     var charges = [];
//     var errors = [];
//     var warnings = []; 
//     var notes = [];
//     Step(
//       function () {
//         if (vehicles.length > 0) {
//           var _this = _.after(vehicles.length, this);
//           _.each(vehicles, function (veh) {
//             Step(
//               function () {
//                 sampleDb.fetchSamples(veh._id, '_drive', {}, this.parallel());
//                 sampleDb.fetchSamples(veh._id, '_charge', {}, this.parallel());
//                 sampleDb.fetchSamples(veh._id, '_error', {}, this.parallel());
//                 sampleDb.fetchSamples(veh._id, '_warning', {}, this.parallel());
//                 sampleDb.fetchSamples(veh._id, '_note', {}, this.parallel());
//               },
//               function (err, _drives, _charges, _errors, _warnings, _notes) {
//                 if (err) return cb(err);
//                 function addType(type) {
//                   return function (not) {
//                     not.type = type;
//                     if (!(opts && opts.vehicleId))
//                       not.vehicle = veh;
//                   }
//                 }
//                 _.each(_drives, addType('_drive'));
//                 _.each(_charges, addType('_charge'));
//                 _.each(_errors, addType('_error'));
//                 _.each(_warnings, addType('_warning'));
//                 _.each(_notes, addType('_note'));
//                 drives = drives.concat(_drives);
//                 charges = charges.concat(_charges);
//                 errors = errors.concat(_errors);
//                 warnings = warnings.concat(_warnings);
//                 notes = notes.concat(_notes);
//                 _this();
//               }
//             );
//           });
//         } else this();
//       },
//       function (err) {
//         if (err) return cb(err);
//         var _sort = _.after(notes.length, sort);
//         _.each(notes, function (note) {
//           userDb.findUserById(note.val.userId, function (err, usr) {
//             if (err) return cb(err);
//             delete usr.password;
//             delete usr.salt;
//             delete usr.pin;
//             delete usr.vehicles;
//             delete usr.fleets;
//             note.user = usr;
//             _sort();
//           });
//         });
//         function sort() {
//           var bins = {};
//           var threads = [];
//           var threadedNotes = [];
//           _.each(notes, function (note) {
//             var key = String(note.beg) + String(note.end);
//             if (!(key in bins)) bins[key] = [];
//             bins[key].push(note);
//           });
//           _.each(bins, function (bin) {
//             threads.push(bin);
//           });
//           _.each(threads, function (thread) {
//             thread.sort(function (a, b) {
//               return a.val.date - b.val.date;
//             });
//             var note = thread[0];
//             note.replies = _.rest(thread);
//             note.latest = _.last(thread).val.date;
//             threadedNotes.push(note);
//           });
//           var notifications = [].concat(drives, charges, errors,
//                                         warnings, threadedNotes);
//           notifications.sort(function (a, b) {
//             var at = a.latest ? a.latest * 1e3 : a.beg;
//             var bt = b.latest ? b.latest * 1e3 : b.beg;
//             return bt - at;
//           });
//           cb(null, notifications);
//         }
//       }
//     );
//   }

//   function fetchFinderTree(type, cb) {
//     switch (type) {
//       case 'users':
//         // ensureAdmin(_.bind(fetchUserTree, this, cb));
//         fetchUserTree(cb);
//         break;
//       case 'vehicles':
//         fetchVehicleTree(cb);
//         break;
//       case 'teams':
//         fetchTeamTree(cb);
//         break;
//       case 'fleets':
//         fetchFleetTree(cb);
//         break;
//     }
//   } 

//   function fetchUserTree(cb) {
//     var self = this;
//     var accessList;
//     var tree = [];
//     Step(
//       function () {
//         userDb.getAccessList(this.parallel());
//         userDb.collections.users.find({}).toArray(this.parallel());
//       },
//       function (err, list, users) {
//         if (err) return cb(err);
//         var next = this;
//         accessList = list;
//         if (users.length === 0)
//           return cb(null, []);


//         var _next = _.after(users.length, next);
//         _.each(users, function (user) {
//           user.type = 'users';
//           var access = _.filter(accessList, function (acc) {
//             return acc.granteeType === 'users'
//                    && acc.granteeId === user._id;
//           });
//           tree.push(user);
//           if (access.length === 0)
//             return _next();
//           user.sub = [];
//           var __next = _.after(access.length, _next);
//           _.each(access, function (acc) {
//             userDb.collections[acc.targetType].findOne({ _id: acc.targetId },
//                                                         function (err, doc) {
//               if (err) return cb(err);
//               doc.type = acc.targetType;
//               user.sub.push(doc);
//               __next();
//             });
//           });
//         });
//       },
//       function (err) {
//         if (err) return cb(err);
//         cb(null, tree);
//       }
//     );
//   }

//   function fetchVehicleTree(cb) {
//     if (req.user.data.vehicles.length === 0)
//       return cb(null, []);
//     var accessList;
//     var tree = [];
//     Step(
//       function () {
//         userDb.getAccessList(this);
//       },
//       function (err, list) {
//         if (err) return cb(err);
//         var next = this;
//         accessList = list;
//         var _next = _.after(req.user.data.vehicles.length, next);
//         _.each(req.user.data.vehicles, function (veh) {
//           var veh = _.clone(veh);
//           veh.type = 'vehicles';
//           var access = _.filter(accessList, function (acc) {
//             return acc.targetType === 'vehicles'
//                    && acc.targetId === veh._id;
//           });
//           tree.push(veh);
//           if (access.length === 0)
//             return _next();
//           veh.sub = [];
//           var __next = _.after(access.length, _next);
//           _.each(access, function (acc) {
//             userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
//                                                         function (err, doc) {
//               if (err) return cb(err);
//               doc.type = acc.granteeType;
//               delete doc.vehicles;
//               delete doc.fleets;
//               // TODO: get team members, admins, domains
//               // add them to the team's sub.
//               veh.sub.push(doc);
//               __next();
//             });
//           });
//         });
//       },
//       function (err) {
//         if (err) return cb(err);
//         var next = this;
//         var matchedFleets = [];
//         userDb.collections.fleets.find({}).toArray(function (err, fleets) {
//           if (err) return cb(err);
//           var _next = _.after(fleets.length, next);
//           _.each(fleets, function (fleet) {
//             _.each(tree, function (veh) {
//               var match = _.find(fleet.vehicles, function (id) {
//                                 return id === veh._id; });
//               if (match) {
//                 fleet.type = 'fleets';
//                 if (!veh.sub) veh.sub = [];
//                 veh.sub.push(fleet);
//                 if (!_.find(matchedFleets, function (f) {
//                       return f._id === fleet._id; }))
//                   matchedFleets.push(fleet);
//               }
//             });
//             _next(null, matchedFleets);
//           });
//         });
//       },
//       function (err, fleets) {
//         if (err) return cb(err);
//         var next = this;
//         if (fleets.length === 0)
//           return next();
//         var _next = _.after(fleets.length, next);
//         _.each(fleets, function (fleet) {
//           var access = _.filter(accessList, function (acc) {
//             return acc.targetType === 'fleets'
//                    && acc.targetId === fleet._id;
//           });
//           if (access.length === 0)
//             return _next();
//           fleet.sub = [];
//           var __next = _.after(access.length, _next);
//           _.each(access, function (acc) {
//             userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
//                                                         function (err, doc) {
//               if (err) return cb(err);
//               doc.type = acc.granteeType;
//               delete doc.vehicles;
//               delete doc.fleets;
//               // TODO: get team members, admins, domains
//               // add them to the team's sub.
//               fleet.sub.push(doc);
//               __next();
//             });
//           });
//         });
//       },
//       function (err) {
//         if (err) return cb(err);
//         cb(null, tree);
//       }
//     );
//   }

//   function fetchTeamTree(cb) {
//     var self = this;
//     var accessList;
//     var tree = [];
//     Step(
//       function () {
//         userDb.getAccessList(this.parallel());
//         userDb.collections.teams.find({}).toArray(this.parallel());
//       },
//       function (err, list, teams) {
//         if (err) return cb(err);
//         var next = this;
//         accessList = list;
//         if (teams.length === 0)
//           return cb(null, []);
//         var _next = _.after(teams.length, next);
//         _.each(teams, function (team) {
//           team.type = 'teams';
//           var access = _.filter(accessList, function (acc) {
//             return acc.granteeType === 'teams'
//                    && acc.granteeId === team._id;
//           });
//           tree.push(team);
//           if (access.length === 0)
//             return _next();
//           team.sub = [];
//           var __next = _.after(access.length, _next);
//           _.each(access, function (acc) {
//             userDb.collections[acc.targetType].findOne({ _id: acc.targetId },
//                                                         function (err, doc) {
//               if (err) return cb(err);
//               doc.type = acc.targetType;
//               team.sub.push(doc);
//               __next();
//             });
//           });
//         });
//       },
//       function (err) {
//         if (err) return cb(err);
//         cb(null, tree);
//       }
//     );
//   }

//   function fetchFleetTree(cb) {
//     var accessList;
//     var tree = [];
//     Step(
//       function () {
//         userDb.getAccessList(this.parallel());
//         userDb.collections.fleets.find({}).toArray(this.parallel());
//       },
//       function (err, list, fleets) {
//         if (err) return cb(err);
//         var next = this;
//         accessList = list;
//         if (fleets.length === 0)
//           return cb(null, []);
//         var _next = _.after(fleets.length, next);
//         _.each(fleets, function (fleet) {
//           fleet.type = 'fleets';
//           var access = _.filter(accessList, function (acc) {
//             return acc.targetType === 'fleets'
//                    && acc.targetId === fleet._id;
//           });
//           tree.push(fleet);
//           if (access.length === 0)
//             return _next();
//           fleet.sub = [];
//           var __next = _.after(access.length, _next);
//           _.each(access, function (acc) {
//             userDb.collections[acc.granteeType].findOne({ _id: acc.granteeId },
//                                                         function (err, doc) {
//               if (err) return cb(err);
//               doc.type = acc.granteeType;
//               delete doc.vehicles;
//               delete doc.fleets;
//               // TODO: get team members, admins, domains
//               // add them to the team's sub.
//               fleet.sub.push(doc);
//               __next();
//             });
//           });
//           // TODO: add fleet vehicles to sub
//         });
//       },
//       function (err) {
//         if (err) return cb(err);
//         cb(null, tree);
//       }
//     );
//   }

//   //// Methods that need authorization ////

//   // Fetch samples.
//   // TODO: get rid of subscriptions, 
//   // replace with 'wait until data available' option.
//   function fetchSamples(vehicleId, channelName, options, cb) {
//     if (!UserDb.haveAccess(vehicleId, req.user.data.vehicles))
//       return cb('Permission denied.');
//     sampleDbExecutionQueue(function (done) {
//       var id = 'fetchSamples(' + vehicleId + ', ' + channelName + ') ';
//       function next(err, samples) {
//         cb(err, samples);
//         // TODO: subscriptions broken with execution queue.
//         done();
//       };
//       if (options.subscribe != null) {
//         var handle = options.subscribe;
//         options.subscribe = 0.25;  // Polling interval, seconds.
//         cancelSubscribeSamples(handle);
//         subscriptions[handle] =
//             sampleDb.fetchSamples(vehicleId, channelName, options, next);
//       } else {
//         sampleDb.fetchSamples(vehicleId, channelName, options, next);
//       }
//     });
//   }

//   /**
//    * Insert samples.
//    *
//    *   sampleSet = {
//    *     <channelName>: [ samples ],
//    *     ...
//    *   }
//    */
//   function insertSamples(vehicleId, sampleSet, options, cb) {
//     if (_.isFunction(options) && cb == null) {
//       cb = options;
//       options = {};
//     }
//     sampleDb.insertSamples(vehicleId, sampleSet, options, cb);
//   }

//   // Fetch channel tree.
//   // TODO: move this into client code, use _schema subscription instead.
//   function fetchChannelTree(vehicleId, cb) {
//     sampleDb.fetchSamples(vehicleId, '_schema', {},
//                           errWrap(cb, function (samples) {
//       cb(null, SampleDb.buildChannelTree(samples));
//     }));
//   }

//   function fetchVehicleConfig(vehicleId, cb) {
//     var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
//     var templateFilePath = __dirname + '/public/vconfig/template.xml';
//     fs.readFile(idFilePath, 'utf8',
//         function (err, data) {
//       if (err) {
//         fs.readFile(templateFilePath, 'utf8',
//             function (err, data) {
//           data = data.replace(/\[vid\]/, vehicleId);
//           fs.writeFile(idFilePath, data, function (err) {
//             log("XML Configuration File CREATED for Vehicle " + vehicleId);
//             cb(err, data);
//           });
//         });
//       } else {
//         cb(err, data);
//       }
//     });
//   }

//   function saveVehicleConfig(vehicleId, data, cb) {
//     var idFilePath = __dirname + '/public/vconfig/id/' + vehicleId + '.xml';
//     var generation = data.match(/<config generation="([0-9]*)">/);
//     if (generation && generation[1] !== "") {
//       var genNum = parseInt(generation[1]);
//       data = data.replace('<config generation="' + genNum + '">',
//                           '<config generation="' + (genNum + 1) + '">');
//     }
//     fs.writeFile(idFilePath, data, function (err) {
//       log("XML Configuration File SAVED for Vehicle " + vehicleId);
//       cb(err, data);
//     });
//   }


//   //// Methods that do NOT need authorization ////

//   /*
//    * Stop receiving subscription data.
//    */
//   function cancelSubscribeSamples(handle, cb) {
//     // No need to check auth.
//     if (handle != null && subscriptions[handle]) {
//       sampleDb.cancelSubscription(subscriptions[handle]);
//       delete subscriptions[handle];
//     }
//     if (cb) cb();
//   }

//   /*
//    * Create a new link describing a GUI state.
//    */
//   function saveLink(str, cb) {
//     userDb.createLink({ val: str }, function (err, link) {
//       cb(err, link.key);
//     });
//   }


//   //// Methods accessible to remote side: ////

//   return {
//     authorize: authorize,
//     fetchVehicles: fetchVehicles,
//     fetchEvents: fetchEvents,

//     fetchFinderTree: fetchFinderTree,

//     fetchSamples: ensureAuth(fetchSamples),
//     insertSamples: ensureAuth(insertSamples, ['insert']),
//     fetchChannelTree: ensureAuth(fetchChannelTree),
//     fetchVehicleConfig: ensureAuth(fetchVehicleConfig, ['config']),
//     saveVehicleConfig: ensureAuth(saveVehicleConfig, ['config']),
//     addNote: ensureAuth(insertSamples, ['note']),

//     cancelSubscribeSamples: cancelSubscribeSamples,
//     saveLink: saveLink,
//   };
// };
