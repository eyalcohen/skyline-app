/*!
 * Copyright 2011 Mission Motors
 */

define(['models/notification',
    'models/vehicle',
    'models/map',
    'models/graph',
    'models/user',
    'models/tree'],
    function () {
  return {
    NotificationModel: arguments[0],
    VehicleModel: arguments[1],
    MapModel: arguments[2],
    GraphModel: arguments[3],
    UserModel: arguments[4],
    TreeModel: arguments[5],
  };
});

