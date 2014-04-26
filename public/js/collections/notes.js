/*
 * Notes collection.
 */

define([
  'collections/boiler/list',
  'models/note'
], function (List, Model) {
  return List.extend({

    model: Model,

    comparator: function (model) {
      return -model.get('beg');
    },

  });
});
