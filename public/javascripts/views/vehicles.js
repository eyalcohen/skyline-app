/*!
 * Copyright 2011 Mission Motors
 */

define(function () {
  return Backbone.View.extend({
    initialize: function (args) {
      this.firstRender = true;
      _.bindAll(this, 'destroy');
      return App.subscribe('NotAuthenticated', this.destroy);
    },

    setup: function () {
      this.content = $('.dashboard-item-content', this.el);
      return this;
    },

    events: {
      'click .toggler': 'toggle',
      'click .row-vehicle': 'clickHandler',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        rows: []
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('vehicles.dash.jade', opts).appendTo(App.regions.left);
      this.setup();
      this.delegateEvents();
      if (this.firstRender) {
        this.firstRender = false;
        this.el.fadeIn('fast');
      } else {
        this.content.hide();
        this.el.show();
        this.content.show('fast');
      }
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    destroy: function () {
      if (this.timer)
        clearInterval(this.timer);
      this.remove();
    },

    toggle: function (e) {
      var target = $(e.target);
      if (this.content.is(':visible')) {
        this.content.hide('fast');
        target.text('+');
        target.attr('title', 'expand');
      } else {
        this.content.show('fast');
        target.text('-');
        target.attr('title', 'shrink');
      }
    },

    clickHandler: function (e) {
      e.preventDefault();
      console.log('sdcdscv');
      // return App.api.signin(this.email.val(),
      //     this.password.val(),
      //     _.bind(function (err, user) {
      //   if (err !== null) {
      //     switch (err.code) {
      //       case 'MISSING_FIELD':
      //         App.publish('NotAuthenticated', [{
      //           email: err.email,
      //           password: err.password,
      //           report: err.message,
      //           missing: err.missing
      //         }]);
      //         break;
      //       case 'BAD_AUTH':
      //         App.publish('NotAuthenticated', [{
      //           email: err.email,
      //           report: err.message
      //         }]);
      //         break;
      //     }
      //     return;
      //   }
      //   App.cache.set('user', user);
      //   App.user = App.cache.get('user');
      //   return this.el.fadeOut('fast', _.bind(function () {
      //     this.remove();
      //     App.publish('UserWasAuthenticated');
      //   }, this));
      // }, this));
    },
    
    setTime: function () {
      $('[data-last-seen]', this.el).each(function (i) {
        var time = $(this);
        if (!time.data('ts'))
          time.data('ts', time.attr('data-last-seen'));
        time.text(getRelativeTime(time.data('ts')));
      });

      function getRelativeTime (ts) {
        ts = parseInt(ts);
        var parsed_date = new Date(ts / 1000),
            relative_to = (arguments.length > 1) ?
                arguments[1] / 1000 : new Date(),
            delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
        if (delta < 5) return 'just now';
        else if (delta < 15) return 'just a moment ago';
        else if (delta < 30) return 'just a few moments ago';
        else if (delta < 60) return 'less than a minute ago';
        else if (delta < 120) return 'about a minute ago';
        else if (delta < (45 * 60)) 
          return (parseInt(delta / 60)).toString() + ' minutes ago';
        else if (delta < (90 * 60)) 
          return 'about an hour ago';
        else if (delta < (24 * 60 * 60)) {
          var h = (parseInt(delta / 3600)).toString();
          if (h != '1') return 'about ' + h + ' hours ago';
          else return 'about an hour ago';
        }
        else if (delta < (2 * 24 * 60 * 60)) 
          return 'about a day ago';
        else if (delta < (10 * 24 * 60 * 60)) 
          return (parseInt(delta / 86400)).toString() + ' days ago';
        else return new Date(ts / 1000).toLocaleDateString();
      }
    },

  });
});

