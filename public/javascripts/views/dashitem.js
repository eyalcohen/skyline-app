/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      this.firstRender = true;
      _.bindAll(this, 'destroy');
      App.subscribe('NotAuthenticated', this.destroy);
      return this;
    },

    setup: function () {
      this.toggler = $('.toggler', this.el);
      this.content = $('.dashboard-item-content', this.el);
      return this;
    },

    events: {
      'click a.toggler': 'toggle',
    },

    destroy: function () {
      if (this.timer)
        clearInterval(this.timer);
      this.remove();
      return this;
    },

    toggle: function (e) {
      var target = $(e.target);
      this.content.is(':visible') ?
        this.minimize(target):
        this.maximize(target);
      return this;
    },

    minimize: function () {
      this.content.hide('fast');
      this.toggler.text('+').attr('title', 'expand');
    },

    maximize: function () {
      this.content.show('fast');
      this.toggler.text('-').attr('title', 'shrink');
    },

    setTime: function () {
      $('[data-time]', this.el).each(function (i) {
        var time = $(this);
        if (!time.data('ts'))
          time.data('ts', time.attr('data-time'));
        if (time.data('ts') !== '0')
          time.text(getRelativeTime(time.data('ts')));
        else
          time.text('Never');
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
      return this;
    },

    getId: function (e) {
      var str = $(e.target).parent().parent().attr('id');
      try {
        var items = str.split('_');
        return parseInt(items[items.length - 1]);
      } catch (exception) {
        return null;
      }
    },

  });
});

