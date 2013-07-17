/*
 * Views collection.
 */

define([
  'collections/boiler/list',
  'models/view'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
