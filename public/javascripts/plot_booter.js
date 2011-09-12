/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery','libs/flot/excanvas'], function ($) {
  requirejs(['libs/flot/jquery.colorhelpers'], function () {
    requirejs(['libs/flot/jquery.flot'], function () {
      requirejs(['libs/flot/jquery.colorhelpers',
          'libs/flot/jquery.flot',
          'libs/flot/jquery.flot.categories',
          'libs/flot/jquery.flot.crosshair',
          'libs/flot/jquery.flot.fillbetween',
          'libs/flot/jquery.flot.navigate',
          'libs/flot/jquery.flot.resize',
          'libs/flot/jquery.flot.selection',
          'libs/flot/jquery.flot.stack',
          'libs/flot/jquery.flot.symbol',
          'libs/flot/jquery.flot.threshold'], function () {
        return true;
      });
    });
  });
});

