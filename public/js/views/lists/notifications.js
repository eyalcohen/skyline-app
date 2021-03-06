/*
 * Notification List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'Spin',
  'text!../../../templates/lists/notifications.html',
  'collections/notifications',
  'views/rows/notification'
], function ($, _, List, mps, rest, Spin, template, Collection, Row) {
  return List.extend({

    el: '.notifications',

    fetching: false,
    nomore: false,
    limit: 10,

    // misc. init
    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket Subscriptions
      this.app.rpc.socket.on('notification.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('notification.read', _.bind(this.read, this));
      this.app.rpc.socket.on('notification.removed', _.bind(this._remove, this));

      // Init the load indicator.
      this.spin = new Spin($('.notifications-spin', this.$el.parent()),
          {color: '#8f8f8f', lines: 13, length: 3, width: 2, radius: 6});
      this.spin.start();
  
      // Reset the collection.
      this.latest_list = this.app.profile.content.notifications || {items: []};
      this.collection.reset(this.latest_list.items);
    },

    // receive note from event bus
    collect: function (data) {
      this.collection.unshift(data);
    },

    // receive update from event bus
    read: function (data) {
      var view = _.find(this.views, function (v) {
        return v.model.id === data.id;
      });

      if (view) {
        view.update();
        // mps.publish('notification/change', []);
      }
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length > 0)
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      else {
        this.nomore = true;
        $('<span class="empty-feed">No notifications.</span>').appendTo(this.$el);
        this.spin.stop();
      }
      this.paginate();
      return this;
    },

    // render the latest model
    // (could be newly arived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      // mps.publish('notification/change', []);
      _.delay(_.bind(function () {
        if (pagination !== true)
          this.checkHeight();
      }, this), 20);
      return this;
    },

    // misc. setup
    setup: function () {
      this.spin.stop();
      // mps.publish('notification/change', []);
      List.prototype.setup.call(this);
    },

    // Kill this view.
    destroy: function () {
      this.unpaginate();
      // this.app.rpc.socket.removeAllListeners('notification.new');
      // this.app.rpc.socket.removeAllListeners('notification.read');
      // this.app.rpc.socket.removeAllListeners('notification.removed');
      return List.prototype.destroy.call(this);
    },

    // remove a model
    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          this.checkHeight();
          // mps.publish('notification/change', []);
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
        this.latest_list = list;
        var showingall = $('.list-spin .empty-feed', this.$el.parent());
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            $('<span class="empty-feed">No notifications.</span>')
                .appendTo(this.$el);
          }
        } else
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        _.delay(_.bind(function () {
          this.spin.stop();
          this.fetching = false;
          if (list.items.length < this.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              showingall.css('display', 'block');
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) return;

      // there are no more, don't call server
      if (this.nomore || !this.latest_list.more)
        return updateUI.call(this, _.defaults({items:[]}, this.latest_list));

      // get more
      this.spin.start();
      this.fetching = true;
      rest.post('/api/notifications/list', {
        subscriber_id: this.app.profile.user.id,
        limit: this.limit,
        cursor: this.latest_list.cursor,
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.notifications);

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
    } 

  });
});
