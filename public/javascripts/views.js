/*!
 * Copyright 2011 Mission Motors
 */

define([
    'views/dashTab',
    'views/editor',
    'views/events',
    'views/graph',
    'views/login',
    'views/logout',
    'views/main',
    'views/map',
    'views/timeline',
    'views/tree',
    'views/users',
    'views/vehicles',
    'views/vehicleTab',
    'views/manageTab',
    'views/finder',
    'views/info'
    ], function () {
  return {
    DashTabView: arguments[0],
    EditorView: arguments[1],
    EventsView: arguments[2],
    GraphView: arguments[3],
    LoginView: arguments[4],
    LogoutView: arguments[5],
    MainView: arguments[6],
    MapView: arguments[7],
    TimelineView: arguments[8],
    TreeView: arguments[9],
    UsersView: arguments[10],
    VehiclesView: arguments[11],
    VehicleTabView: arguments[12],
    ManageTabView: arguments[13],
    FinderView: arguments[14],
    InfoView: arguments[15],
  };
});

