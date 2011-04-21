

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
        
        
        // initial vehicle cycle query 
        $('a.expander').live('click', function () {
          $.get('/v/' + $(this).itemID(), { id: $(this).itemID() }, function (serv) {
            if (serv.status == 'success') {
              console.log(serv.data.bucks);
            } else
              console.log(serv.message);
          });
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

