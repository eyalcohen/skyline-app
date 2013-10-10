/*
 * Async execution of RPCs to the server.
 */

define([
  'jQuery',
  'Underscore',
  'mps'
], function ($, _, mps) {
  return {  

    exec: function(type, url, data, cb) {
      if (!data || typeof data === 'function') {
        cb = data;
        data = null;
      }
      cb = cb || function(){};

      var params = {
        url: url,
        type: type,
        success: _.bind(cb, cb, undefined),
        error: function (res) {
          var err;
          try {
            err = JSON.parse(res.responseText);
            var data = err.data;
            err = {message: err.error, code: res.status};
            if (data) err.data = data;
          } catch (e) { err = res.status + ' - "' + res.statusText + '"'; }
          cb(err);
        },
        contentType: 'application/json', 
        dataType: 'json'
      };
      if (data)
        if (type === 'POST')
          params.data = JSON.stringify(data);
        else {
          params.url += '?';
          _.each(data, function (v, k) {
            if (params.url[params.url.length - 1] !== '?')
              params.url += '&';
            params.url += k + '=' + encodeURIComponent(JSON.stringify(v));
          });
        }
      return $.ajax(params);
    },

    get: function (url, data, cb) {
      this.exec('GET', url, data, cb);
    },

    post: function (url, data, cb) {
      this.exec('POST', url, data, cb);
    },

    put: function (url, data, cb) {
      if (!data || typeof data === 'function') {
        cb = data;
        data = null;
      }

      data._method = 'PUT';
      this.exec('POST', url, data, cb);
    },

    delete: function (url, data, cb) {
      if (!data || typeof data === 'function') {
        cb = data;
        data = null;
      }

      data._method = 'DELETE';
      this.exec('POST', url, data, cb);
    }

  }
});
