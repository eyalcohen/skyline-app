// $.fn.serializeObject = function () {
//   var o = {},
//       a = this.serializeArray();
//   $.each(a, function () {
//     if (o[this.name]) {
//       if (!o[this.name].push)
//         o[this.name] = [o[this.name]];
//       o[this.name].push(this.value || '');
//     } else {
//       o[this.name] = this.value || '';
//     }
//   });
//   return o;
// };
// 
// $.fn.itemId = function () {
//   try {
//     var items = $(this).attr('id').split('_');
//     return items[items.length - 1];
//   } catch (exception) {
//     return null;
//   }
// };
// 
// // var _oldShow = $.fn.show;
// // $.fn.show = function(speed, oldCallback) {
// //   return $(this).each(function() {
// //     var
// //       obj         = $(this),
// //       newCallback = function() {
// //         if ($.isFunction(oldCallback)) {
// //           oldCallback.apply(obj);
// //         }
// //         console.log('sdfvsfdvf');
// //         obj.trigger('isvisible');
// //       };
// // 
// //     // you can trigger a before show if you want
// //     // obj.trigger('beforeShow');
// // 
// //     // now use the old function to show the element passing the new callback
// //     _oldShow.apply(obj, [speed, newCallback]);
// //   });
// // };
// 
// $.fn.appendToAt = function (parent, i) {
//   var $this = $(this);
//   if (i === 0) {
//     $this.prependTo(parent);
//   } else {
//     $('div:nth-child(' + i + ')', parent).before($this);
//   }
//   return $this;
// };
// 
