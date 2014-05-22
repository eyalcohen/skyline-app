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
  'text!../../../templates/lists/datasets.finder.html',
  'collections/datasets',
  'views/rows/dataset.finder',
  'Spin'
], function ($, _, List, mps, rest, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '.finder-datasets',

    searching: false,
    str: null,
    num: 0,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.modal = options.modal;
      this.options = options;
      if (!this.options.searchQuery) {
        this.options.searchQuery = {};
      }

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('dataset/new', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      this.app.rpc.socket.on('dataset.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('dataset.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.options.datasets.items);
    },

    render: function (options) {
      List.prototype.render.call(this, options);

      // Save refs.
      this.showingAll = this.$('.list-spin .full-feed');

      // Handle height.
      // if (this.modal) {
      //   $(window).resize(_.bind(this.parentView.resize, this.parentView));
      //   _.delay(_.bind(this.parentView.resize, this.parentView), 0);

      //   // Init the load indicator.
      //   this.listSpin = this.$('.list-spin');
      //   this.spin = new Spin(this.$('.finder-datasets-spin'), {
      //     lines: 13,
      //     length: 3,
      //     width: 2,
      //     radius: 6
      //   });

      //   this.wrap = this.$('.library-items-wrap');
      //   if (this.collection.length > 0 || this.latestList.more)
      //     _.delay(_.bind(function () {
      //       this.checkHeight();
      //     }, this), (this.collection.length + 1) * 30);
      //   else {
      //     this.nomore = true;
      //     this.listSpin.hide();
      //     $('<span class="empty-feed">' + this.emptyLabel
      //         + '</span>').appendTo(this.wrap);
      //   }
      //   this.paginate();
      } else if (this.collection.length === 0)
        $('<span class="empty-feed">' + this.emptyLabel + '</span>')
            .appendTo(this.$el);

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
        }, this), 20);
      return this;
    },

    setup: function () {
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      // this.app.rpc.socket.removeAllListeners('dataset.new');
      // this.app.rpc.socket.removeAllListeners('dataset.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (this.searching) return;
      if (data.author.id === this.app.profile.user.id) {
        this.collection.unshift(data);
      }
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return Number(v.model.id) === Number(data.id);
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          if (this.collection.length === 0
              && this.$('.empty-feed').length === 0) {
            $('<span class="empty-feed">Nothing to see here!</span>')
                .appendTo(this.$el);
          }
        }, this));
      }
    },

    search: function (str) {
      if (this.searching) return false;
      this.searching = true;
      str = str.trim();
      if (str === this.str) {
        this.searching = false;
        return false;
      }
      this.str = str;
      if (str.length === 0) {
        this.searching = false;
        if (this.$('.empty-feed').length === 0)
          $('<span class="empty-feed">Nothing found.</span>')
              .appendTo(this.wrap);
        this.restore();
        return false;
      }

      // Clear items.
      this._clear();
      this.showingAll.hide();
      this.$('.empty-feed').remove();

      // Perform search.
      this.spin.start();
      rest.post('/api/datasets/search/' + str, this.options.searchQuery,
          _.bind(function (err, data) {
        this.searching = false;
        if (err) return console.log(err);

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
      this.latestList = this.options.datasets;
      this.collection.reset(this.latestList.items);
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
        this.latestList = list;
        if (list.items.length === 0) {
          this.nomore = true;
          this.fetching = false;
          if (this.modal) {
            this.spin.stop();
            this.spin.target.hide();
          }
          if (this.collection.length > 0)
            this.showingAll.css('display', 'block');
          else {
            this.showingAll.hide();
            if (this.modal)
              this.listSpin.hide();
            if (this.$('.empty-feed').length === 0)
              $('<span class="empty-feed">' + this.emptyLabel + '</span>')
                  .appendTo(this.wrap);
          }
        } else
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));

        _.delay(_.bind(function () {
          this.fetching = false;
          if (this.modal)
            this.spin.stop();
          if (list.items.length < this.latestList.limit) {
            if (this.modal)
              this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              this.showingAll.css('display', 'block');
          } else {
            this.showingAll.hide();
            if (this.modal)
              this.spin.target.show();
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) return;

      // Show spin region.
      if (this.modal)
        this.listSpin.show();

      // there are no more, don't call server
      if (this.nomore || !this.latestList.more)
        return updateUI.call(this, _.defaults({items:[]}, this.latestList));

      // get more
      if (this.modal)
        this.spin.start();
      this.fetching = true;
      rest.post('/api/datasets/list', {
        limit: this.latestList.limit,
        cursor: this.latestList.cursor,
        query: this.latestList.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.spin.target.hide();
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
