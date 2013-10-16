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
    working: false,
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
      this.spin = new Spin($('.profile-datasets-spin', this.$el.parent()));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

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
      this.paginate();
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

      // Safe el refs.
      // this.datasetForm = this.$('#dataset_form');
      // this.dropZone = this.$('.profile-dnd').show();

      // // Add mouse events for dummy file selector.
      // var dummy = this.$('#dataset_file_chooser_dummy');
      // this.$('#dataset_file_chooser').on('mouseover', function (e) {
      //   dummy.addClass('hover');
      // })
      // .on('mouseout', function (e) {
      //   dummy.removeClass('hover');
      // })
      // .on('mousedown', function (e) {
      //   dummy.addClass('active');
      // })
      // .change(_.bind(this.drop, this));
      // $(document).on('mouseup', function (e) {
      //   dummy.removeClass('active');
      // });

      // Drag & drop events.
      // this.dropZone.on('dragover', _.bind(this.dragover, this))
      //     .on('dragleave', _.bind(this.dragout, this))
      //     .on('drop', _.bind(this.drop, this));

      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.unpaginate();
      return List.prototype.destroy.call(this);
    },

    collect: function (dataset) {
      if (dataset.author.id === this.parentView.model.id)
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

    /*************************
     * Drag and drop support *
     *************************/

    dragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.dropZone.addClass('dragging');
    },

    dragout: function (e) {
      this.dropZone.removeClass('dragging');
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Stop drag styles.
      this.dropZone.removeClass('dragging');

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) return;

      // Just use the first one for now.
      // TODO: multiple files -> datasets.
      var file = files[0];

      // Use a FileReader to read the file as a base64 string.
      var reader = new FileReader();
      reader.onload = _.bind(function () {

        // Check file type for any supported...
        // The MIME type could be text/plain or application/vnd.ms-excel
        // or a bunch of other options.  For now, switch to checking the
        // extension and consider improved validation down the road, particularly
        // as we add support for new file types
        var ext = file.name.split('.').pop();
        if (ext !== 'csv' && ext !== 'xls')
          return false;

        // Construct the payload to send.
        var payload = {
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
            ext: ext
          },
          base64: reader.result.replace(/^[^,]*,/,''),
        };

        // Mock dataset.
        var data = {
          id: -1,
          author: this.app.profile.user,
          updated: new Date().toISOString(),
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
          },
          meta: {
            beg: 0,
            end: 0,
            channel_cnt: 0,
          }
        };

        // Optimistically add dataset to page.
        this.collection.unshift(data);

        // Create the dataset.
        this.app.rpc.do('insertSamples', payload,
            _.bind(function (err, res) {

          if (err)
            return console.error(err);

          if (res.created === false) {

            // Remove row.
            this.working = false;
            return this._remove({id: -1});
          }

          // Update the dataset id.
          var dataset = this.collection.get(-1);
          dataset.set('client_id', res.client_id);
          dataset.set('meta', res.meta);
          dataset.set('id', res.id);
          this.$('#-1').attr('id', res.id);

          // Ready for more.
          this.working = false;

        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
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
          // this.spin.stop();
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
        var pos = this.$el.height() + this.$el.offset().top
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
