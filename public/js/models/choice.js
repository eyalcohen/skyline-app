/*
 * Choice model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    href: function () {
      var href = '';
      switch (this.get('_type')) {
        case 'users':
          href = '/' + this.get('username');
          break;
        case 'datasets':
          href = [this.get('author').username, this.get('id')].join('/');
          break;
        case 'views':
          href = [this.get('author').username, 'views', this.get('slug')].join('/');
          break;
        case 'channels':
          href = [this.get('parent').author.username, this.get('parent').id, 
                 this.get('channelName')].join('/');
          break;
      }
      console.log('href', href);
      return href;
    },

    title: function () {
      var title = '';
      switch (this.get('_type')) {
        case 'users':
          title += '<strong>' + this.get('displayName') + '</strong>'
              + ' (@' + this.get('username') + ')';
          break;
        case 'datasets':
          if (this.get('parent'))
            title = '<i class="icon-database"><i class="icon-split"></i></i>';
          else if (this.get('public') === false)
            title = '<i class="icon-lock"></i>';
          else
            title = '<i class="icon-database"></i>';
          var tmp = this.get('author').username + '/';
          if (this.get('title') && this.get('title') !== '')
            tmp += '<strong>' + this.get('title') + '</strong>';
          if (tmp === '')
            title += this.get('key');
          else title += tmp;
          break;
        case 'views':
          if (this.get('parent'))
            title = '<i class="icon-folder-empty"><i class="icon-split"></i></i>';
          else if (this.get('public') === false)
            title = '<i class="icon-lock"></i>';
          else
            title = '<i class="icon-folder-empty"></i>';
          var tmp = this.get('author').username + '/';
          if (this.get('name') && this.get('name') !== '')
            tmp += '<strong>' + this.get('name') + '</strong>';
          if (tmp === '')
            title += this.get('key');
          else title += tmp;
          break;
        case 'channels':
          if (this.get('dataset') && this.get('dataset').public === false)
            title = '<i class="icon-lock"></i>';
          else
            title = '<i class="icon-chart-line"></i>';
          title += '<strong>' +  this.get('humanName') + '</strong>' || [''];
          if (this.get('parent'))
            title += ' in ' + this.get('parent').title;
          break;
          
      }
      return title;
    },

    term: function () {
      var term = '';
      switch (this.get('_type')) {
        case 'users':
          term += this.get('displayName') + ' (@' + this.get('username') + ')';
          break;
        case 'datasets':
          term += this.get('title');
          break;
        case 'views':
          term += this.get('name');
          break;
        case 'channels':
          term += this.get('humanName');
          break;
      }
      return term;
    },

  });
});
