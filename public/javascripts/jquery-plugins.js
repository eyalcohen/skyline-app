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

$.fn.itemId = function () {
  try {
    var items = $(this).attr('id').split('_');
    return items[items.length - 1];
  } catch (exception) {
    return null;
  }
};

// var _oldShow = $.fn.show;
// $.fn.show = function(speed, oldCallback) {
//   return $(this).each(function() {
//     var
//       obj         = $(this),
//       newCallback = function() {
//         if ($.isFunction(oldCallback)) {
//           oldCallback.apply(obj);
//         }
//         console.log('sdfvsfdvf');
//         obj.trigger('isvisible');
//       };
// 
//     // you can trigger a before show if you want
//     // obj.trigger('beforeShow');
// 
//     // now use the old function to show the element passing the new callback
//     _oldShow.apply(obj, [speed, newCallback]);
//   });
// };

/*
 * jQuery throttle / debounce - v1.1 - 3/7/2010
 * http://benalman.com/projects/jquery-throttle-debounce-plugin/
 * 
 * Copyright (c) 2010 "Cowboy" Ben Alman
 * Dual licensed under the MIT and GPL licenses.
 * http://benalman.com/about/license/
 */
(function(b,c){var $=b.jQuery||b.Cowboy||(b.Cowboy={}),a;$.throttle=a=function(e,f,j,i){var h,d=0;if(typeof f!=="boolean"){i=j;j=f;f=c}function g(){var o=this,m=+new Date()-d,n=arguments;function l(){d=+new Date();j.apply(o,n)}function k(){h=c}if(i&&!h){l()}h&&clearTimeout(h);if(i===c&&m>e){l()}else{if(f!==true){h=setTimeout(i?k:l,i===c?e-m:e)}}}if($.guid){g.guid=j.guid=j.guid||$.guid++}return g};$.debounce=function(d,e,f){return f===c?a(d,e,false):a(d,f,e!==false)}})(this);

