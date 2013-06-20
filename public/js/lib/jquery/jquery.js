/*
 * jQuery wrapper.
 */

define(['lib/jquery/jquery.min'], function () {

  jQuery.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    jQuery.each(a, function () {
      if (o[this.name] !== undefined) {
        if (!o[this.name].push)
          o[this.name] = [o[this.name]];
        o[this.name].push(this.value || '');
      } else o[this.name] = this.value || '';
    });
    return o;
  };

  jQuery.stableSort = function(array, compare) {
    function merge(a1, a2) {
      var l1 = a1.length, l2 = a2.length, l = l1 + l2, r = new Array(l);
      for (var i1 = 0, i2 = 0, i = 0; i < l;) {
        if (i1 === l1)
          r[i++] = a2[i2++];
        else if (i2 === l2 || compare(a1[i1], a2[i2]) <= 0)
          r[i++] = a1[i1++];
        else
          r[i++] = a2[i2++];
      }
      return r;
    }
    function sort(a) {
      var l = a.length, m = Math.ceil(l / 2);
      return (l <= 1) ? a : merge(sort(a.slice(0, m)), sort(a.slice(m)));
    }
    return sort(array);
  }

  return jQuery;
});
