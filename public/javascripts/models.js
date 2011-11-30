/*!
 * Copyright 2011 Mission Motors
 */

define(['models/notification',
    'models/vehicle',
    'models/vehicleTab',
    'models/map',
    'models/graph',
    'models/user',
    'models/tree',
    /* 'models/navigator' */],
    function () {
  return {
    NotificationModel: arguments[0],
    VehicleModel: arguments[1],
    VehicleTabModel: arguments[2],
    MapModel: arguments[3],
    GraphModel: arguments[4],
    UserModel: arguments[5],
    TreeModel: arguments[6],
    // NavigatorModel: arguments[7],
  };
});

