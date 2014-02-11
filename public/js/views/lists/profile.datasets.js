/*
 * Profile Datasets List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/profile.datasets.html',
  'collections/datasets',
  'views/rows/profile.dataset',
  'Spin'
], function ($, _, List, mps, rest, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.profile-datasets',
    fetching: false,
    nomore: false,
    limit: 10,
    searching: false,
    str: null,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.modal = options.modal;
      this.options = options;
      if (!this.options.searchQuery) this.options.searchQuery = {};

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('dataset/new', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      this.app.rpc.socket.on('dataset.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('dataset.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = 'No data sources.';

      // Reset the collection.
      this.latest_list = this.options.datasets;
      this.collection.reset(this.latest_list.items);
    },

    // Initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);

      // Handle height.
      if (this.modal) {
        $(window).resize(_.bind(this.parentView.resize, this.parentView));
        _.delay(_.bind(this.parentView.resize, this.parentView), 0);

        // Init the load indicator.
        this.spin = new Spin($('.profile-datasets-spin', this.$el.parent()), {
          lines: 13,
          length: 3,
          width: 2,
          radius: 6,
        });

        this.wrap = this.$('.profile-items-wrap');
        if (this.collection.length > 0 || this.latest_list.more)
          _.delay(_.bind(function () {
            this.checkHeight();
          }, this), (this.collection.length + 1) * 30);
        else {
          this.nomore = true;
          $('<span class="empty-feed">' + this.empty_label
              + '</span>').appendTo(this.wrap);
        }
        this.paginate();
      }

      return this;
    },

    // Render the latest model
    // (could be newly arived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      if (this.modal)
        _.delay(_.bind(function () {
          if (pagination !== true)
            this.checkHeight();
        }, this), 60);
      return this;
    },

    setup: function () {

      // Save refs.
      this.showingall = this.$('.list-spin .full-feed');

      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      if (this.modal) this.unpaginate();
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (this.searching) return;
      var user_id = this.parentView.model ?
          this.parentView.model.id: this.app.profile.user.id;
      if (data.author.id === user_id)
        this.collection.unshift(data);
    },

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
          if (this.modal) this.checkHeight();
        }, this));
      }
    },

    search: function (str) {

      // Check search string.
      if (str.length === 0)
        return this.restore();

      // Clear items.
      this.spin.stop();
      this._clear();
      this.showingall.hide();
      this.$('.empty-feed').remove();

      str = str === '' || str.length < 2 ? null: str;
      this.str = str;

      if (!str) {
        $('<span class="empty-feed">Nothing found.</span>')
            .appendTo(this.wrap);
        return;
      }

      // Perform search.
      this.searching = true;
      this.spin.start();
      rest.post('/api/datasets/search/' + str, this.options.searchQuery,
          _.bind(function (err, data) {
        if (err)
          return console.log(err);

        if (data.items.length === 0) {
          $('<span class="empty-feed">Nothing found.</span>')
              .appendTo(this.wrap);
        } else {

          // Add to collection.
          _.each(data.items, _.bind(function (i) {
            this.collection.unshift(i);
          }, this));
        }

        this.spin.stop();
      }, this));

    },

    restore: function () {
      this.searching = false;
      this.nomore = false;
      this.latest_list = this.options.datasets;
      this.collection.reset(this.latest_list.items);
    },

    // Clear the collection w/out re-rendering.
    _clear: function () {
      _.each(this.views, _.bind(function (v) {
        v.destroy();
        this.collection.remove(v.model);
      }, this));
    },

    /**********************
     * Pagination support *
     **********************/

    // Check the panel's empty space and get more items to fill it up.
    checkHeight: function () {
      var wh = this.$el.parent().parent().height();
      var so = this.spin.target.position().top;
      if (wh - so > this.spin.target.height() / 2)
        this.more();
    },

    // attempt to get more models (older) from server
    more: function () {
      if (this.searching) return;

      // render models and handle edge cases
      function updateUI(list) {
        _.defaults(list, {items:[]});
        this.latest_list = list;
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          if (this.collection.length > 0)
            this.showingall.css('display', 'block');
          else {
            this.showingall.hide();
            if (this.$('.empty-feed').length === 0)
              $('<span class="empty-feed">' + this.empty_label + '</span>')
                  .appendTo(this.wrap);
          }
        } else
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        _.delay(_.bind(function () {
          this.fetching = false;
          if (list.items.length < this.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              this.showingall.css('display', 'block');
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
      rest.post('/api/datasets/list', {
        limit: this.limit,
        cursor: this.latest_list.cursor,
        query: this.latest_list.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.datasets);

      }, this));

    },

    // init pagination
    paginate: function () {
      this._paginate = _.debounce(_.bind(function (e) {
        var pos = $('table', this.wrap).height()
            - this.wrap.height() - this.wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);
      this.wrap.scroll(this._paginate).resize(this._paginate);
    },

    unpaginate: function () {
      this.wrap.unbind('scroll', this._paginate)
          .unbind('resize', this._paginate);
    }

  });
});
