/*
 * jQuery wrapper.
 */

define([
  'lib/jquery/jquery.min'
], function () {

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

  require([
    'lib/jquery/jquery.colorhelpers',
    'lib/jquery/jquery.flot'
  ], function () {
    require([
      'lib/jquery/jquery.flot.categories',
      'lib/jquery/jquery.flot.crosshair',
      'lib/jquery/jquery.flot.fillbetween',
      'lib/jquery/jquery.flot.navigate',
      'lib/jquery/jquery.flot.selection',
      'lib/jquery/jquery.flot.stack',
      'lib/jquery/jquery.flot.symbol',
      'lib/jquery/jquery.flot.threshold'
    ]);    
  });

  return jQuery;
});
