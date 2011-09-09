/*!
 * Copyright 2011 Mission Motors
 */

define(['views/login',
    'views/logout',
    'views/notifications',
    'views/vehicles',
    'views/map'],
    function () {
  return {
    LoginView: arguments[0],
    LogoutView: arguments[1],
    NotificationsView: arguments[2],
    VehiclesView: arguments[3],
    MapView: arguments[4],
  };
});

