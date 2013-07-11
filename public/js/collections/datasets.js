/*
 * Datasets collection.
 */

define([
  'collections/boiler/list',
  'models/dataset'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
