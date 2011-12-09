(function ($) {

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

})(jQuery);

(function($) {

    /*
     * Auto-growing textareas; technique ripped from Facebook
     */
    $.fn.autogrow = function(options) {
        
        this.filter('textarea').each(function() {
            
            var $this       = $(this),
                minHeight   = $this.height(),
                lineHeight  = $this.css('lineHeight');
            
            var shadow = $('<div></div>').css({
                position:   'absolute',
                top:        -10000,
                left:       -10000,
                width:      $(this).width(),
                fontSize:   $this.css('fontSize'),
                fontFamily: $this.css('fontFamily'),
                lineHeight: $this.css('lineHeight'),
                resize:     'none'
            }).appendTo(document.body);
            
            var update = function() {
                
                var val = this.value.replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/&/g, '&amp;')
                                    .replace(/\n/g, '<br/>');
                
                shadow.html(val);
                $(this).css('height', Math.max(shadow.height() + 13, minHeight));
            }
            
            $(this).change(update).keyup(update).keydown(update);
            
            update.apply(this);
            
        });
        
        return this;
        
    }
    
})(jQuery);

