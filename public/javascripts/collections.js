/*!
 * Copyright 2011 Mission Motors
 */

define(['collections/notification',
    'collections/vehicle',
    'collections/user'
    ],
    function () {
  return {
    NotificationCollection: arguments[0],
    VehicleCollection: arguments[1],
    UserCollection: arguments[2],
  };
});

