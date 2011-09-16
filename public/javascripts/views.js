/*!
 * Copyright 2011 Mission Motors
 */

define(['views/login',
    'views/logout',
    'views/notifications',
    'views/vehicles',
    'views/map',
    'views/graph',
    'views/vehicle',
    'views/users',
    'views/tree'],
    function () {
  return {
    LoginView: arguments[0],
    LogoutView: arguments[1],
    NotificationsView: arguments[2],
    VehiclesView: arguments[3],
    MapView: arguments[4],
    GraphView: arguments[5],
    VehicleView: arguments[6],
    UsersView: arguments[7],
    TreeView: arguments[8],
  };
});

