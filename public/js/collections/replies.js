/*
 * Replies collection.
 */

define([
  'collections/boiler/list',
  'models/reply'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
