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
  'common',
  'Spin',
  'text!../../templates/chart.html',
  'text!../../templates/chart.header.html',
  'views/lists/datasets',
  'views/lists/notes',
  'views/lists/comments',
  'views/graph',
  'views/export',
  'views/overview',
  'views/share'
], function ($, _, Backbone, mps, rest, util, units, common, Spin, template,
      header, Datasets, Notes, Comments, Graph, Export, Overview, Share) {
  return Backbone.View.extend({

    className: 'chart',
    working: false,

    // Module entry point.
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events.
      this.on('rendered', this.setup, this);

      this.requestedChannels = [];

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/add', _.bind(function (did, channel, yaxis) {
          if (this.graph.model.getChannels().length === 0) {
            mps.publish('chart/zoom', [{min: channel.beg / 1000, max: channel.end / 1000}]);
          }
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
          this.refreshNotes();
        }, this)),
        mps.subscribe('dataset/removed', _.bind(function () {
          this.refreshNotes();
        }, this)),
        mps.subscribe('notes/refresh', _.bind(function () {
          this.refreshNotes();
        }, this)),
        mps.subscribe('channel/channelListFetched', _.bind(function (did, channels) {
          this.openRequestedChannels(did, channels);
        }, this)),
        mps.subscribe('view/new', _.bind(this.saved, this)),
        mps.subscribe('graph/drawComplete', _.bind(this.updateNotes, this)),
        mps.subscribe('note/cancel', _.bind(this.unnote, this)),
        mps.subscribe('state/change', _.bind(this.onStateChange, this)),
        mps.subscribe('dataset/requestOpenChannel', _.bind(function (channelName) {
          this.requestedChannels.push(channelName);
        }, this))
      ];
    },

    // Draw our template from the profile.
    render: function () {

      // Use model to store view data.
      this.model = new Backbone.Model;

      // Set page title.
      if (!this.app.embed) {
        var page = this.app.profile.content.page;
        if (page && page.name) {
          this.app.title(page.author.username + '/' + page.name,
              _.template(header)({page: page}), true);
        } else this.app.title('Chart', '');
      }

      // Render main template.
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
      'click .control-button-share': 'share',
      'mousemove .graphs': 'updateCursor',
      'mouseleave .graphs': 'hideCursor',
      'mousedown .note-button': 'note',
      'click .note-cancel-button': 'note'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.noteDuration = this.$('.note-duration-button');
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
        radius: 6
      });

      // Handle comments panel.
      if (!this.app.embed && store.get('comments'))
        $('.side-panel').addClass('open');

      // Drag & drop events.
      if (this.app.embed) {
        this.$el.bind('dragover', _.bind(this.dragover, this));
        this.dropZone.bind('dragleave', _.bind(this.dragout, this))
            .bind('drop', _.bind(this.drop, this));
      }

      // Handle save button.
      if (store.get('state').author && store.get('state').author.id)
        // This is a view, so intially it's already saved.
        this.saveButton.addClass('saved');

      // Render children views.
      this.graph = new Graph(this.app, {parentView: this}).render();
      this.datasets = new Datasets(this.app, {parentView: this});
      this.comments = new Comments(this.app, {parentView: this});
      this.notes = new Notes(this.app, {parentView: this});
      this.overview = new Overview(this.app, {parentView: this}).render();

      // Do resize on window change.
      this.resize();
      _.delay(_.bind(this.resize, this), 20);
      _.delay(_.bind(this.resize, this), 100);
      _.delay(_.bind(this.resize, this), 500);
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      $(window).resize(_.debounce(_.bind(this.resize, this), 100));
      $(window).resize(_.debounce(_.bind(this.resize, this), 500));

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
      this.app.title();
      this.datasets.destroy();
      this.graph.destroy();
      this.notes.destroy();
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
      if (this.app.profile.content.page) {
        return {
          doc: this.app.profile.content.page,
          id: Number(this.app.profile.content.page.id), 
          type: 'view'
        };
      } else if (this.app.profile.content.datasets
          && this.app.profile.content.datasets.items.length !== 0) {
        return {
          doc: this.app.profile.content.datasets.items[0],
          id: Number(this.app.profile.content.datasets.items[0].id),
          type: 'dataset'
        };
      } else return {};
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
          err: {message: {message: 'No data found.'}},
          level: 'error'
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
        time: state.time,
        lineStyleOptions: state.lineStyleOptions,
        staticImg: $('.flot-base').get(0).toDataURL('image/png'),
      };

      // If this is a view and user is view owner, do "save".
      // Other cases should not happen because the button will not be presented.
      if (this.app.profile.content.page.author.id === user.id) {

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
              mps.publish('flash/new', [{err: err, level: 'error'}]);
            }, 500);
            this.working = false;
            return;
          }

          // Updates.
          this.saveButton.addClass('saved');
          var now = new Date().toISOString();
          _.extend(this.app.profile.content, res);
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
          err: {message: {message: 'No data found.'}},
          level: 'error'
        }]);
        return;
      }
      mps.publish('modal/save/open', [target]);
    },

    download: function (e) {
      e.preventDefault();
      if (this.graph.model.getChannels().length > 0)
        new Export(this.app, {parentView: this}).render();
      else
        mps.publish('flash/new', [{
          message: 'No data to download.',
          level: 'alert'
        }]);
    },

    share: function (e) {
      e.preventDefault();
      if (this.graph.model.getChannels().length > 0) {
        var options = {
          parentView: this,
          view: this.app.profile.content.page,
          dataset: this.app.profile.content.datasets.items[0]
        };
        new Share(this.app, options).render();
      } else
        mps.publish('flash/new', [{
          message: 'No data to share.',
          level: 'alert'
        }]);
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
      this.cursor.css({left: Math.ceil(this.cursorData.x)});
    },

    hideCursor: function (e) {
      if (!this.cursor.hasClass('active'))
        this.cursor.fadeOut('fast');
    },

    note: function (e) {
      if (e) e.preventDefault();
      if (this.app.embed) return;
      if (!this.app.profile.user) return;
      if (!this.target().id) return;
      if (!this.cursorData) return;

      // Designating cancel...
      if (this.cursor.hasClass('active')) {
        this.cursor.removeClass('active');
        mps.publish('note/cancel');
      
      // Start the note...
      } else {
        this.graph.$el.css({'pointer-events': 'none'});
        this.cursor.addClass('active').addClass('selecting');
        mps.publish('note/start', [this.cursorData]);

        var doc = $(document);
        var mousemove = _.bind(function (e) {
          e.preventDefault();
          var current = this.graph.cursor(e);
          var abs = Math.abs(this.cursorData.t - current.t);
          if (abs > 0) {
            $('span', this.noteDuration).text(util.getDuration(abs*1000, false));
            this.noteDuration.css({left: current.x - this.cursorData.x
                - this.noteDuration.outerWidth()/2}).show();
          } else this.noteDuration.hide();
          mps.publish('note/move', [this.cursorData, this.graph.cursor(e)]);
          return false;
        }, this);
        var mouseup = _.bind(function (e) {
          e.preventDefault();
          doc.unbind('mouseup', mouseup).unbind('mousemove', mousemove);
          this.cursor.removeClass('selecting');
          mps.publish('note/end', [this.graph.cursor(e), e]);
          return false;
        }, this);
        doc.bind('mouseup', mouseup).bind('mousemove', mousemove);
      }
    },

    unnote: function () {
      if (this.app.embed) return;
      this.noteDuration.hide();
      this.cursor.removeClass('active');
      this.graph.$el.css({'pointer-events': 'auto'});
    },

    refreshNotes: function () {
      this.notes.reset();
      this.updateNotes();
    },

    saved: function () {
      if (this.comments) this.comments.empty();
      this.comments = new Comments(this.app, {parentView: this, type: 'view'});
      this.$('.control-button').removeClass('view-only');
      this.saveButton.addClass('saved');
      this.app.title(this.app.profile.content.page.name);
    },

    updateNotes: function () {
      if (!this.graph || !this.graph.plot || !this.notes) return;
      var xaxis = this.graph.plot.getXAxes()[0];
      var vs = this.graph.getVisibleTime();
      if (!vs.beg) return;

      // Update x-pos of each note.
      _.each(this.notes.views, _.bind(function (v) {
        var beg = v.model.get('beg');
        var end = v.model.get('end');
        var xpos = xaxis.p2c(v.model.get('beg'));
        var width = xaxis.p2c(v.model.get('end')) - xpos;
        width = width < 2 ? 2: width;
        var width_per = 1e3 * (end - beg) / (vs.end - vs.beg);
        v.model.set('opacity', (1-width_per)*0.25);
        v.model.set('width', width);
        v.model.set('xpos', xpos);
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

      if (files.length === 0) {
        this.working = false;
        return false;
      }
      var file = files[0];

      // Use a FileReader to read the file as a base64 string.
      var cbFail = _.bind(function(err) {
        // Stop load indicator.
        this.app.router.stop();
        this.$el.removeClass('dragging');
        // Show error.
        _.delay(function () {
          mps.publish('flash/new', [{
            message: err,
            level: 'error'
          }]);
        }, 500);
        this.working = false;
      }, this);

      var cbSuccess = _.bind(function() {
        // Stop load indicator.
        this.app.router.stop();
        this.$el.removeClass('dragging');

        // Ready for more.
        this.working = false;
      }, this);

      var cbProgress = _.bind(function(perc) {
      }, this);

      var cbUpload = _.bind(function(res) {
        if (res.channels[0])
          mps.publish('dataset/requestOpenChannel', [res.channels[0].channelName]);

        // Add this dataset to the existing chart.
        mps.publish('dataset/select', [res.id]);
      }, this);


      var reader = new FileReader();
      reader.onload = _.bind(function () {
        common.upload(file, reader, this.app, cbSuccess, cbFail, cbProgress, cbUpload);
      }, this);

      reader.readAsDataURL(file);

      return false;
    },

    onStateChange: function (state) {
      var user = this.app.profile.user;

      // If this is explore mode, i.e. (/chart), do nothing.
      if (!state.author || !state.author.id || !user) return;

      // If this is a view and user is view owner, indicate state is not saved.
      if (state.author.id === user.id)
        this.saveButton.removeClass('saved');
    },

    // adds any pending channel requests, or at least one if none are open
    openRequestedChannels: function(did, channels) {

      _.each(this.requestedChannels, function (requestedChannel) {
        var found = _.find(channels, function (chn) {
          return requestedChannel === chn.channelName;
        });
        if (found) {
          mps.publish('channel/add', [did, found]);
        }
      });

      // check if we have any channels open
      // we automatically open the first channel if none are open or requested
      var state = store.get('state');
      if (!state.datasets[did].channels) {
        mps.publish('channel/add', [did, channels[0]]);
      }
    },

  });
});
