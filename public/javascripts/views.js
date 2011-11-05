/*!
 * Copyright 2011 Mission Motors
 */

define(['views/main',
    'views/login',
    'views/logout',
    'views/notifications',
    'views/vehicles',
    'views/map',
    'views/graph',
    'views/vehicle',
    'views/users',
    'views/tree',
    'views/navigator',
    'views/dash',
    'views/editor'],
    function () {
  return {
    MainView: arguments[0],
    LoginView: arguments[1],
    LogoutView: arguments[2],
    NotificationsView: arguments[3],
    VehiclesView: arguments[4],
    MapView: arguments[5],
    GraphView: arguments[6],
    VehicleView: arguments[7],
    UsersView: arguments[8],
    TreeView: arguments[9],
    NavigatorView: arguments[10],
    DashView: arguments[11],
    EditorView: arguments[12],
  };
});

