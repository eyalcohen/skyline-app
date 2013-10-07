/*
 * Channels collection.
 */

define([
  'collections/boiler/list',
  'models/channel'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
