/*
 * Chart view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'units',
  'Spin',
  'text!../../templates/chart.html',
  'views/lists/datasets',
  'views/lists/comments',
  'views/graph',
  'views/exportdata',
  'views/overview'
], function ($, _, Backbone, mps, rest, util, units, Spin, template, Datasets,
      Comments, Graph, ExportData, Overview) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'chart',
    working: false,

    // Module entry point.
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/add', _.bind(function (did, channel) {
          this.graph.model.addChannel(this.datasets.collection.get(did),
              _.clone(channel));
          this.overview.model.addChannel(this.datasets.collection.get(did),
              _.clone(channel));
        }, this)),
        mps.subscribe('channel/remove', _.bind(function (did, channel) {
          this.graph.model.removeChannel(this.datasets.collection.get(did),
              _.clone(channel));
          this.overview.model.removeChannel(this.datasets.collection.get(did),
              _.clone(channel));
        }, this)),
        mps.subscribe('dataset/added', _.bind(function () {
          this.refreshComments();
        }, this)),
        mps.subscribe('dataset/removed', _.bind(function () {
          this.refreshComments();
        }, this)),
        mps.subscribe('comments/refresh', _.bind(function () {
          this.refreshComments();
        }, this)),
        mps.subscribe('view/new', _.bind(this.saved, this)),
        mps.subscribe('graph/draw', _.bind(this.updateIcons, this)),
        mps.subscribe('comment/end', _.bind(this.uncomment, this)),
        mps.subscribe('state/change', _.bind(this.onStateChange, this)),
      ];
    },

    // Draw our template from the profile.
    render: function (embed) {

      // Use model to store view data.
      this.model = new Backbone.Model;

      // Set page title
      if (!embed) {
        var page = this.app.profile.content.page;
        if (page && page.name) this.app.title(page.name);
        else this.app.title('Chart', '');
      }

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .control-button-daily': 'daily',
      'click .control-button-weekly': 'weekly',
      'click .control-button-monthly': 'monthly',
      'click .control-button-save': 'save',
      'click .control-button-fork': 'fork',
      'click .control-button-download': 'download',
      'click .control-button-comments': 'panel',
      'mousemove .graphs': 'updateCursor',
      'mouseleave .graphs': 'hideCursor',
      'click .comment-button': 'comment',
      'click .comment-cancel-button': 'comment'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.sidePanel = this.$('.side-panel');
      this.lowerPanel = this.$('.lower-panel');
      this.controls = this.$('.controls');
      this.cursor = this.$('.cursor');
      this.icons = this.$('.icons');
      this.dropZone = this.$('.dnd');
      this.saveButton = this.$('.control-button-save');
      this.saveButtonSpin = new Spin($('.save-button-spin', this.el), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Handle comments panel.
      if (store.get('comments'))
        $('.side-panel').addClass('open');

      // Drag & drop events.
      this.$el.bind('dragover', _.bind(this.dragover, this));
      this.dropZone.bind('dragleave', _.bind(this.dragout, this))
          .bind('drop', _.bind(this.drop, this));

      // Handle save button.
      if (store.get('state').author_id)
        // This is a view, so intially it's already saved.
        this.saveButton.addClass('saved');

      // Render children views.
      this.graph = new Graph(this.app, {parentView: this}).render();
      this.datasets = new Datasets(this.app, {parentView: this});
      this.comments = new Comments(this.app, {parentView: this});
      this.overview = new Overview(this.app, {parentView: this}).render();

      // Do resize on window change.
      this.resize();
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      $(window).resize(_.debounce(_.bind(this.resize, this), 100));

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.datasets.destroy();
      this.graph.destroy();
      this.comments.destroy();
      this.remove();
    },

    resize: function () {
      var height = $(window).height() - $('footer').height()
          - this.$el.offset().top;
      height = Math.max(height, this.app.embed ? 0: 605);
      this.$el.css({height: height});
      this.fit();
    },

    // Return the current view or index level zero dataset.
    target: function () {
      if (this.app.profile.content.page)
        return {
          doc: this.app.profile.content.page,
          id: Number(this.app.profile.content.page.id), 
          type: 'view'
        };
      else if (this.app.profile.content.datasets
          && this.app.profile.content.datasets.items.length !== 0)
        return {
          doc: this.app.profile.content.datasets.items[0],
          id: Number(this.app.profile.content.datasets.items[0].id),
          type: 'dataset'
        };
      else return {};
    },

    fit: function () {
      if (this.datasets)
        this.datasets.fit(this.$el.width() - this.controls.width());
    },

    daily: function (e) {
      e.preventDefault();
      mps.publish('chart/zoom', [60*60*24]);
    },

    weekly: function (e) {
      e.preventDefault();
      mps.publish('chart/zoom', [60*60*24*7]);
    },

    monthly: function (e) {
      e.preventDefault();
      mps.publish('chart/zoom', [60*60*24*30]);
    },

    save: function (e) {
      e.preventDefault();

      // No need to save.
      if (this.saveButton.hasClass('saved')) return;

      // Prevent multiple saves at the same time.
      if (this.working) return false;
      this.working = true;

      // If this is explore mode, i.e. (/chart), do "save as".
      var target = this.target();
      if (!target.doc) {

        // Show error.
        mps.publish('flash/new', [{
          message: 'No data found.',
          level: 'error',
          sticky: false
        }]);
        this.working = false;
        return false;
      }
      if (target.type === 'dataset') {
        this.working = false;
        mps.publish('modal/save/open');
        return false;
      }

      // Build payload for "save".
      var user = this.app.profile.user;
      var state = store.get('state');
      var payload = {
        datasets: state.datasets,
        time: state.time
      };

      // If this is a view and user is view owner, do "save".
      // Other cases should not happen because the button will not be presented.
      if (this.app.profile.content.page.author_id === user.id) {

        // Indicate save.
        this.saveButton.addClass('saving');
        this.saveButtonSpin.start();

        rest.put('/api/views/' + state.id, payload, _.bind(function (err, res) {

          // Indicate done.
          this.saveButton.removeClass('saving');
          this.saveButtonSpin.stop();

          if (err) {
            // Show error.
            _.delay(function () {
              mps.publish('flash/new', [{
                message: err,
                level: 'error',
                sticky: false
              }]);
            }, 500);
            this.working = false;
            return;
          }

          // Updates.
          this.saveButton.addClass('saved');
          var now = new Date().toISOString();
          this.app.profile.content.page = res;
          _.extend(state, {
            updated: now,
          });
          // Update state silently (not through App.prototype.state)
          // so as to not trigger a "not saved" status.
          store.set('state', state);

          // Show alert
          _.delay(function () {
            mps.publish('flash/new', [{
              message: 'Saved.',
              level: 'alert',
              sticky: false,
              delay: 2000,
            }]);
          }, 500);

          // Ready for more.
          this.working = false;

        }, this));
      } else {
        this.working = false;
        return false;
      }
    },

    fork: function (e) {
      e.preventDefault();
      var target = this.target();
      if (!target.doc) {
        mps.publish('flash/new', [{
          message: 'No data found.',
          level: 'error',
          sticky: false
        }]);
        return;
      }
      mps.publish('modal/save/open', [target]);
    },

    download: function (e) {
      e.preventDefault();
      this.exportdata = new ExportData(this.app, {parentView: this}).render();
    },

    panel: function (e) {
      if (e) e.preventDefault();
      if (this.sidePanel.hasClass('open')) {
        this.sidePanel.removeClass('open');
        store.set('comments', false);
      } else {
        this.sidePanel.addClass('open');
        store.set('comments', true);
      }
    },

    updateCursor: function (e) {
      if (!this.graph || this.cursor.hasClass('active')) return;
      this.cursorData = this.graph.cursor(e);
      if (this.cursorData.x === undefined) return;
      this.cursor.fadeIn('fast');
      this.cursor.css({left: this.cursorData.x});
    },

    hideCursor: function (e) {
      if (!this.cursor.hasClass('active'))
        this.cursor.fadeOut('fast');
    },

    comment: function (e) {
      if (this.app.embed) return;
      if (!this.target().id) return;
      if (!this.cursorData) return;
      if (this.cursor.hasClass('active'))
        mps.publish('comment/end');
      else {
        this.cursor.addClass('active');
        this.graph.$el.css({'pointer-events': 'none'});
        if (!this.sidePanel.hasClass('open')) {
          this.sidePanel.addClass('open');
          store.set('comments', true);
          _.delay(_.bind(function () {
            mps.publish('comment/start', [this.cursorData]);
          }, this), 300);
        } else
          mps.publish('comment/start', [this.cursorData]);
      }
    },

    uncomment: function () {
      if (this.app.embed) return;
      this.cursor.removeClass('active');
      this.graph.$el.css({'pointer-events': 'auto'});
    },

    refreshComments: function () {
      this.comments.reset();
      this.updateIcons();
    },

    saved: function () {
      if (this.comments) this.comments.empty();
      this.comments = new Comments(this.app, {parentView: this, type: 'view'});
      this.$('.control-button').removeClass('view-only');
      this.saveButton.addClass('saved');
      this.app.title(this.app.profile.content.page.name);
    },

    updateIcons: function (force) {
      if (!this.graph || !this.graph.plot || !this.comments) return;
      var xaxis = this.graph.plot.getXAxes()[0];

      // Update x-pos of each comment.
      _.each(this.comments.views, _.bind(function (v) {
        v.model.set('xpos', xaxis.p2c(v.model.get('time')) - 8);
        if (!$.contains(document.documentElement, v.icon.get(0))) {
          v.icon.appendTo(this.icons);
        }
      }, this));
    },

    dragover: function (e) {
      if (this.dragging) return false;
      this.dragging = true;
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.$el.addClass('dragging');
      return false;
    },

    dragout: function (e) {
      if ($(e.target).prop('tagName') === 'I') return false;
      this.dragging = false;
      this.$el.removeClass('dragging');
      return false;
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      var files = e.originalEvent.dataTransfer.files;
      this.add(null, files);

      return false;
    },

    // Create new dataset from file.
    // TODO: Redundant fn. Move this and this
    // same fn in browser.js somewhere shared.
    add: function (e, files) {
      if (e) e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Start load indicator.
      this.app.router.start();

      // Get the file.
      var files = files || this.newFile.get(0).files;

      if (files.length === 0) return false;
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
        if (ext !== 'csv' && ext !== 'xls') {
          this.$el.removeClass('dragging');
          return false;
        }

        // Construct the payload to send.
        var payload = {
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
            ext: ext
          },
          base64: reader.result.replace(/^[^,]*,/,'')
        };
        if (this.app.embed)
          payload.user = 'demo';

        // Create the dataset.
        this.app.rpc.do('insertSamples', payload,
            _.bind(function (err, res) {

          // Stop load indicator.
          this.app.router.stop();
          this.$el.removeClass('dragging');

          if (err) {

            // Show error.
            _.delay(function () {
              mps.publish('flash/new', [{
                message: err,
                level: 'error',
                sticky: false
              }]);
            }, 500);
            this.working = false;
            return;
          }

          // Show alert
          _.delay(function () {
            mps.publish('flash/new', [{
              message: 'You added a new data source: "'
                  + res.title + ', ' + res.meta.channel_cnt + ' channel'
                  + (res.meta.channel_cnt !== 1 ? 's':'') + '"',
              level: 'alert',
              sticky: false
            }]);
          }, 500);

          // Publish new dataset.
          if (!this.app.embed) {
            mps.publish('dataset/new', [res]);

            // Add this dataset to the existing chart.
            mps.publish('dataset/select', [res.id]);
          
          // TODO: This should function like the above case,
          // but will be confusing until we have a macro view.
          } else {
            var path = [res.author.username, res.id].join('/');
            this.app.router.navigate('/' + path, {trigger: true});
            mps.publish('embed/update', [window.location.host + '/embed/' + path]);
          }

          // Ready for more.
          this.working = false;
        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
    },

    onStateChange: function (state) {
      var user = this.app.profile.user;

      // If this is explore mode, i.e. (/chart), do nothing.
      if (!state.author_id || !user) return;

      // If this is a view and user is view owner, indicate state is not saved.
      if (state.author_id === user.id)
        this.saveButton.removeClass('saved');
    },

  });
});
