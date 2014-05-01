/*
 * Events List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../../templates/lists/events.html',
  'collections/events',
  'views/rows/event'
], function ($, _, List, mps, rest, util, Spin, template, Collection, Row) {
  return List.extend({

    el: '.events',

    fetching: false,
    nomore: false,
    attachments: [],

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.events-spin', this.$el.parent()));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('event.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('event.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.latestList = this.app.profile.content.events;
      this.collection.reset(this.latestList.items);
    },

    // receive event from event bus
    collect: function (data) {
      if (!_.contains(this.latestList.actions, data.action_type))
        return;
      if (this.latestList.query) {
        if (this.latestList.query.subscribee_id
            && data.actor_id !== this.latestList.query.subscribee_id
            && data.target_id !== this.latestList.query.subscribee_id)
          return;
        if (this.latestList.query.action) {
          if (data.action_type !== this.latestList.query.action.type)
            return;
          var valid = true;
          _.each(this.latestList.query.action.query, function (v, p) {
            if (v.$ne !== undefined) {
              v = !v.$ne;
              if (!!data.action[p] !== v) valid = false;
            } else if (data.action[p] !== v) valid = false;
          });
          if (!valid) return;
        }
      }
      this.collection.unshift(data);
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      this.spin.stop();
      if (this.collection.length > 0)
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      else {
        this.nomore = true;
        this.listSpin.hide();
        if (this.app.profile.content.private)
          $('<span class="empty-feed">This athlete is private.</span>')
            .appendTo(this.$el);
        else
          $('<span class="empty-feed">Nothing to see here!</span>')
              .appendTo(this.$el);
        this.spin.stop();
        this.spin.target.hide();
      }
      this.paginate();
      return this;
    },

    // render the latest model
    // (could be newly arrived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);

      // Handle day headers.
      var view = pagination !== true && this.collection.options
          && this.collection.options.reverse ?
          this.views[0]:
          this.views[this.views.length - 1];  
      var ms = new Date(view.model.get('date')).valueOf();
      var header = this.$('.event-day-header').filter(function () {
        return ms >= Number($(this).data('beg'))
            && ms <= Number($(this).data('end'));
      });
      if (header.length > 0) {
        if (pagination !== true)
          header.detach().insertBefore(view.$el);
      } else {
        var _date = new Date(view.model.get('date'));
        var beg = new Date(_date.getFullYear(), _date.getMonth(),
            _date.getDate());
        var end = new Date(_date.getFullYear(), _date.getMonth(),
            _date.getDate(), 23, 59, 59, 999);
        header = $('<div class="event-day-header" data-beg="' + beg.valueOf()
            + '" data-end="' + end.valueOf() + '">' + '<span>'
            + end.format('mmmm dd, yyyy') + '</span></div>');
        header.insertBefore(view.$el);
      }

      // Check for more.
      _.delay(_.bind(function () {
        if (pagination !== true)
          this.checkHeight();
      }, this), 20);
      return this;
    },

    events: {
      'click .events-filter .subtab': 'filter',
    },

    // misc. setup
    setup: function () {

      // Save refs
      this.listSpin = this.parentView.$('.list-spin');
      this.showingAll = this.parentView.$('.list-spin .empty-feed');

      return List.prototype.setup.call(this);
    },

    destroy: function () {
      this.unpaginate();
      this.app.rpc.socket.removeAllListeners('event.new');
      this.app.rpc.socket.removeAllListeners('event.removed');
      return List.prototype.destroy.call(this);
    },

    // remove a model
    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          this.$('.event-day-header').filter(function () {
            return $(this).next('.event').length === 0;
          }).remove();
          this.checkHeight();
        }, this));
      }
    },

    // check the panel's empty space and get more
    // notes to fill it up.
    checkHeight: function () {
      wh = $(window).height();
      so = this.spin.target.offset().top;
      if (wh - so > this.spin.target.height() / 2)
        this.more();
    },

    // attempt to get more models (older) from server
    more: function () {

      // render models and handle edge cases
      function updateUI(list) {
        _.defaults(list, {items:[]});
        this.latestList = list;
        if (list.items.length === 0) {
          this.nomore = true;
          this.fetching = false;
          this.spin.stop();
          this.spin.target.hide();
          if (this.collection.length > 0)
            this.showingAll.css('display', 'block');
          else {
            this.showingAll.hide();
            this.listSpin.hide();
            if (this.$('.empty-feed').length === 0) {
              $('<span class="empty-feed">Nothing to see here!</span>')
                  .appendTo(this.$el);
            }
          }
        } else
          _.each(list.items, _.bind(function (i,o) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));

        _.delay(_.bind(function () {
          this.fetching = false;
          this.spin.stop();
          if (list.items.length < this.latestList.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              this.showingAll.css('display', 'block');
          } else {
            this.showingAll.hide();
            this.spin.target.show();
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) return;

      // Show spin region.
      this.listSpin.show();

      // there are no more, don't call server
      if (this.nomore || !this.latestList.more)
        return updateUI.call(this, _.defaults({items:[]}, this.latestList));

      // get more
      this.spin.start();
      this.fetching = true;
      rest.post('/api/events/list', {
        limit: this.latestList.limit,
        cursor: this.latestList.cursor,
        actions: this.latestList.actions,
        query: this.latestList.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.spin.target.hide();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.events);

      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = $(window);
      this._paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() + this.$el.offset().top
            - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 20);
      wrap.scroll(this._paginate).resize(this._paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate).unbind('resize', this._paginate);
    },

    filter: function (e) {
      e.preventDefault();

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active')) return;
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Update list query.
      switch (chosen.data('filter')) {
        case 'all':
          this.latestList.actions = ['dataset', 'view'];
          break;
        case 'dataset':
          this.latestList.actions = ['dataset'];
          break;
        case 'view':
          this.latestList.actions = ['view'];
          break;
      }

      // Set feed state.
      store.set('feed', {actions: chosen.data('filter')});

      // Reset the collection.
      this.nomore = false;
      this.latestList.cursor = 0;
      this.latestList.more = true;
      this.collection.reset([]);
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.views = [];
      this.$('.event-day-header').remove();
      this.showingAll.hide();
      this.more();

      return false;
    },

  });
});
