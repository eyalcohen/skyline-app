/*
 * Choices collection
 */

define([
  'collections/boiler/list',
  'models/search.choice'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
