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

(function ($) {

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
            
            $(this).change(update).keyup(update)
                .keydown(update).bind('remove', function (e) {
              shadow.remove();
            });
            
            update.apply(this);
            
        });
        
        return this;
        
    }
    
})(jQuery);


(function ($) {
  var ev = new $.Event('remove'),
    orig = $.fn.remove;
  $.fn.remove = function () {
    $(this).trigger(ev);
    orig.apply(this, arguments);
    return this;
  }
})(jQuery);

/**
 * jQuery.ScrollTo - Easy element scrolling using jQuery.
 * Copyright (c) 2007-2009 Ariel Flesler - aflesler(at)gmail(dot)com | http://flesler.blogspot.com
 * Dual licensed under MIT and GPL.
 * Date: 5/25/2009
 * @author Ariel Flesler
 * @version 1.4.2
 *
 * http://flesler.blogspot.com/2007/10/jqueryscrollto.html
 */
;(function(d){var k=d.scrollTo=function(a,i,e){d(window).scrollTo(a,i,e)};k.defaults={axis:'xy',duration:parseFloat(d.fn.jquery)>=1.3?0:1};k.window=function(a){return d(window)._scrollable()};d.fn._scrollable=function(){return this.map(function(){var a=this,i=!a.nodeName||d.inArray(a.nodeName.toLowerCase(),['iframe','#document','html','body'])!=-1;if(!i)return a;var e=(a.contentWindow||a).document||a.ownerDocument||a;return d.browser.safari||e.compatMode=='BackCompat'?e.body:e.documentElement})};d.fn.scrollTo=function(n,j,b){if(typeof j=='object'){b=j;j=0}if(typeof b=='function')b={onAfter:b};if(n=='max')n=9e9;b=d.extend({},k.defaults,b);j=j||b.speed||b.duration;b.queue=b.queue&&b.axis.length>1;if(b.queue)j/=2;b.offset=p(b.offset);b.over=p(b.over);return this._scrollable().each(function(){var q=this,r=d(q),f=n,s,g={},u=r.is('html,body');switch(typeof f){case'number':case'string':if(/^([+-]=)?\d+(\.\d+)?(px|%)?$/.test(f)){f=p(f);break}f=d(f,this);case'object':if(f.is||f.style)s=(f=d(f)).offset()}d.each(b.axis.split(''),function(a,i){var e=i=='x'?'Left':'Top',h=e.toLowerCase(),c='scroll'+e,l=q[c],m=k.max(q,i);if(s){g[c]=s[h]+(u?0:l-r.offset()[h]);if(b.margin){g[c]-=parseInt(f.css('margin'+e))||0;g[c]-=parseInt(f.css('border'+e+'Width'))||0}g[c]+=b.offset[h]||0;if(b.over[h])g[c]+=f[i=='x'?'width':'height']()*b.over[h]}else{var o=f[h];g[c]=o.slice&&o.slice(-1)=='%'?parseFloat(o)/100*m:o}if(/^\d+$/.test(g[c]))g[c]=g[c]<=0?0:Math.min(g[c],m);if(!a&&b.queue){if(l!=g[c])t(b.onAfterFirst);delete g[c]}});t(b.onAfter);function t(a){r.animate(g,j,b.easing,a&&function(){a.call(this,n,b)})}}).end()};k.max=function(a,i){var e=i=='x'?'Width':'Height',h='scroll'+e;if(!d(a).is('html,body'))return a[h]-d(a)[e.toLowerCase()]();var c='client'+e,l=a.ownerDocument.documentElement,m=a.ownerDocument.body;return Math.max(l[h],m[h])-Math.min(l[c],m[c])};function p(a){return typeof a=='object'?a:{top:a,left:a}}})(jQuery);
