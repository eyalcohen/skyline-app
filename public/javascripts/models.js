/*!
 * Copyright 2011 Mission Motors
 */

define([
    'models/dashTab',
    'models/events',
    'models/graph',
    'models/map',
    'models/event',
    'models/timeline',
    'models/tree',
    'models/user',
    'models/vehicle',
    'models/vehicleTab'
    ], function () {
  return {
    DashTabModel: arguments[0],
    EventsModel: arguments[1],
    GraphModel: arguments[2],
    MapModel: arguments[3],
    EventModel: arguments[4],
    TimelineModel: arguments[5],
    TreeModel: arguments[6],
    UserModel: arguments[7],
    VehicleModel: arguments[8],
    VehicleTabModel: arguments[9],
  };
});

