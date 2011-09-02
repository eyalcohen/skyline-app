/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

/**
 * Map form data to JSON
 */

$.fn.serializeObject = function () {
  var o = {},
      a = this.serializeArray();
  $.each(a, function () {
    if (o[this.name]) {
      if (!o[this.name].push)
        o[this.name] = [o[this.name]];
      o[this.name].push(this.value || '');
    } else {
      o[this.name] = this.value || '';
    }
  });
  return o;
};
