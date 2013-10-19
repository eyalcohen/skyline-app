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

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.modal = options.modal;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.profile-datasets-spin', this.$el.parent()),
          this.modal ? {
        ines: 13,
        length: 3,
        width: 2,
        radius: 6,
      }: {});
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('dataset/new', _.bind(this.collect, this))
      ];

      // Socket subscriptions
      this.app.rpc.socket.on('dataset.new', _.bind(this.collect, this));

      // Misc.
      this.empty_label = 'No data sources.';

      // Reset the collection.
      this.latest_list = options.datasets;
      this.collection.reset(this.latest_list.items);
    },

    // Initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length > 0 || this.latest_list.more)
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      else {
        this.nomore = true;
        $('<span class="empty-feed">' + this.empty_label
            + '</span>').appendTo(this.$el);
        this.spin.stop();
      }
      if (this.modal)
        this.paginate();
      else {
        this.spin.stop(); 
        this.spin.target.parent().hide();
      }
      return this;
    },

    // render the latest model
    // (could be newly arived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      _.delay(_.bind(function () {
        if (pagination !== true)
          this.checkHeight();
      }, this), 60);
      return this;
    },

    setup: function () {
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.unpaginate();
      return List.prototype.destroy.call(this);
    },

    collect: function (dataset) {
      var user_id = this.parentView.model ?
          this.parentView.model.id: this.app.profile.user.id;
      if (dataset.author.id === user_id)
        this.collection.unshift(dataset);
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
          this.checkHeight();
        }, this));
      }
    },

    /**********************
     * Pagination support *
     **********************/

    // Check the panel's empty space and get more
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
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          var showingall = this.parentView.$('.list-spin .empty-feed');
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            $('<span class="empty-feed">' + this.empty_label + '</span>')
                .appendTo(this.$el);
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
            $('.list-spin .empty-feed', this.$el.parent())
                .css('display', 'block');
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
      var wrap = this.modal ? this.$el.parent(): $(window);
      var paginate = _.debounce(_.bind(function (e) {
        var pos;
        if (this.modal) {
          pos = this.$el.height()
              - wrap.height() - wrap.scrollTop();
        } else
          pos = this.$el.height() + this.$el.offset().top
              - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);

      wrap.scroll(paginate).resize(paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll');
    }

  });
});
