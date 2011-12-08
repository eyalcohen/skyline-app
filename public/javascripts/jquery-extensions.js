$.fn.placeholder = function () {  

  var placeholder = this;
  
  if (placeholder.val().length === 0) {
    var placeholderVal = placeholder.attr("placeholder");
    placeholder.attr("data-placeholder", placeholderVal);
    placeholder.val(placeholderVal);
    placeholder.attr("placeholder", null);
    placeholder.attr("data-type", placeholder.attr("type"));
    if (placeholder.attr("type") === "password") {
      placeholder.attr("type", "text");
    }
    placeholder.addClass("placeholder");
  }

  // Apply events for placeholder handling
  placeholder.bind("focus", setCaret);
  placeholder.bind("drop", setCaret);
  placeholder.bind("click", setCaret);
  placeholder.bind("keydown", clearPlaceholder);
  placeholder.bind("keyup", restorePlaceHolder);
  placeholder.bind("blur", restorePlaceHolder);

  // Set caret at the beginning of the input
  function setCaret(evt) {
    var $this = $(this);
    if ($this.val() === $this.attr("data-placeholder")) {
      this.setSelectionRange(0, 0);
      evt.preventDefault();
      // evt.stopPropagation();
      return false;
    }
  }

  // Clear placeholder value at user input
  function clearPlaceholder(evt) {
    var $this = $(this);
    if (!(evt.shiftKey && evt.keyCode === 16) && evt.keyCode !== 9) {
      if ($this.val() === $this.attr("data-placeholder")) {
        $this.val("");
        $this.removeClass("placeholder");
        if ($this.attr("data-type") === "password") {
          $this.attr("type", "password");
        }
      }
    }
  }

  function restorePlaceHolder() {
    var $this = $(this);
    if ($this.val().length === 0) {
      $this.val($this.attr("data-placeholder"));
      setCaret.apply(this, arguments);
      $this.addClass("placeholder");
      if ($this.attr("type") === "password") {
        $this.attr("type", "text");
      }
    }
  }

  return this;

};

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
