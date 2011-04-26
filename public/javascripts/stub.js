

Stub = (function ($) {
  
  
  
  
  /**
   * get latest drive cycle
   */
   
  var search = function (by, val, fn) {
        jrid.empty();
        var data = {
              by  : by
            , val : val
          };
        $.get('/search/' + val + '.json', data, fn);
      }

    , flipTabSides = function (ctx) {
        var sides = $('.tab-side img', ctx);
        sides.each(function (i) {
          var $this = $(this)
            , old = $this.attr('src')
            , noo = $this.attr('alt')
          ;
          $this.attr({ src: noo, alt: old });
        });
      }
    , TimeSeries = function (wrap) {
        var data
          , canvas = $("<canvas width='" + wrap.width() + "' height='" + wrap.height() + "'></canvas>")
          , ctx
        ;
        
        return {
            init: function (d) {
              // save data
              data = d;
              // remove loading text wrap
              $('.details-loader-wrap', wrap).remove();
              // add canvas
              canvas.prependTo(wrap);
              // text select tool fix for chrome on mousemove
              canvas[0].onselectstart = function () { return false; };
              // get context
              ctx = canvas[0].getContext('2d');
              
            }
          , clear: function () {}
        };
      }
  ;
  
  
  return {
    
    /**
     * setup doc
     */
      
      go: function () {
        
        // determine of object is empty (non-enumerable)
        $.isEmpty = function (o) {
          for (var p in o)
            if (o.hasOwnProperty(p))
              return false;
          return true;
        }
        
        
        // server PUT
        $.put = function (url, data, success) {
          data._method = 'PUT';
          $.post(url, data, success, 'json');
        };
        
        
        // server GET
        $.get = function (url, data, success) {
          data._method = 'GET';
          $.post(url, data, success, 'json');
        };
        
        
        // map form data to JSON
        $.fn.serializeObject = function () {
          var o = {}
            , a = this.serializeArray()
          ;
          $.each(a, function () {
            if (o[this.name]) {
              if (!o[this.name].push)
                o[this.name] = [o[this.name]];
              o[this.name].push(this.value || '');
            } else
              o[this.name] = this.value || '';
          });
          return o;
        };
        
        
        // get database ID
        $.fn.itemID = function () {
          try {
            var items = $(this).attr('id').split('-');
            return items[items.length - 1];
          } catch (exception) {
            return null;
          }
        };
        
        // layer tabs
        var tabs = $('.tab');
        tabs.each(function (i) {
          $this = $(this);
          var z = $this.hasClass('tab-active') ? 
            10001 + tabs.length - i : 
            tabs.length - i
          ;
          $this.css({ zIndex: z });
        });
        
        // click a tab
        tabs.live('click', function () {
          var $this = $(this);
          $('.tab-active').each(function (i) {
            var $this = $(this);
            $this.removeClass('tab-active');
            $this.css({ zIndex: parseInt($this.css('z-index')) - 10001 });
            flipTabSides($this);
            $('.tab-content', $this).addClass('tab-content-inactive');
          });
          $this.addClass('tab-active');
          $this.css({ zIndex: 10001 + parseInt($this.css('z-index')) });
          flipTabSides($this);
          $('.tab-content', $this).removeClass('tab-content-inactive');
        });
        
        
        // initial vehicle cycle query 
        $('a.expander').live('click', function () {
          var $this = $(this)
            , arrow = $('img', $this)
            , deetsHolder = $(this.parentNode.parentNode.nextElementSibling)
            , deets = $(deetsHolder.children(0).children(0))
            //, loader = $()
          ;
          if (!arrow.hasClass('open')) {
            arrow.addClass('open');
            deetsHolder.show();
            deets.animate({ height: 252 }, 150, 'easeOutExpo', function () {
              $.get('/v/' + $this.itemID(), { id: $this.itemID() }, function (serv) {
                if (serv.status == 'success') {
                  var ts = new TimeSeries(deets);
                  ts.init(serv.data.bucks);
                } else
                  console.log(serv.message);
              });
            });
          } else {
            arrow.removeClass('open');
            deetsHolder.hide();
            deets.css({ height: 20 });
          }
        });
        
        $('#logo').bind('click', function (e) {
          $.put('/cycles', {}, function (serv) {
            console.log(JSON.stringify(serv.event));
          });
          //return false;
        });
        
        
        // $('.vehicle-row-link').live('click', function (e) {
        //   e.preventDefault();
        //   var element = $(this)
        //     , form = $('<form></form>')
        //   ;
        //   form
        //     .attr({
        //         method: 'GET'
        //       , action: '/cycles'
        //     })
        //     .hide()
        //     .append('<input type="hidden" />')
        //     .find('input')
        //     .attr({
        //         'name': 'vehId'
        //       , 'value': 'delete'
        //     })
        //     .end()
        //     .submit();
        // });
      
      }


  }

})(jQuery);

