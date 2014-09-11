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
  'views/lists/datasets.chart',
  'views/lists/notes.chart',
  'views/lists/comments.chart',
  'views/graph',
  'views/export',
  'views/overview',
  'views/share',
  'views/map'
], function ($, _, Backbone, mps, rest, util, units, common, Spin, template,
      header, Datasets, Notes, Comments, Graph, Export, Overview, Share, Map) {
  return Backbone.View.extend({

    className: 'chart',
    working: false,

    initialize: function (app, options) {

      this.app = app;
      this.options = options;
      this.on('rendered', this.setup, this);

      this.requestedChannels = [];

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/add', _.bind(function (did, channel, silent) {
          if (this.graph.model.getChannels().length === 0
              && !this.app.profile.content.page
              && !this.app.requestedNoteId
              && !store.get('state').time) {
            mps.publish('chart/zoom', [{min: channel.beg / 1000, max: channel.end / 1000}]);
          }
          this.graph.model.addChannel(this.datasets.collection.get(did),
              _.clone(channel), silent);
          this.overview.model.addChannel(this.datasets.collection.get(did),
              _.clone(channel));
          this.map.addChannel(channel);
        }, this)),
        mps.subscribe('channel/remove', _.bind(function (did, channel) {
          this.graph.model.removeChannel(this.datasets.collection.get(did),
              _.clone(channel));
          this.overview.model.removeChannel(this.datasets.collection.get(did),
              _.clone(channel));
          this.map.removeChannel(channel);
        }, this)),
        mps.subscribe('channel/removed', _.bind(function (did, channel) {
          this.$('#' + channel.channelName + '_value').remove();
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
        mps.subscribe('graph/drawComplete', _.bind(function () {
          this.updateNotes();
          this.removeCursorValues();
        }, this)),
        mps.subscribe('note/cancel', _.bind(this.unnote, this)),
        mps.subscribe('state/change', _.bind(this.onStateChange, this)),
        mps.subscribe('dataset/requestOpenChannel', _.bind(function (channelName) {
          this.requestedChannels.push(channelName);
        }, this))
      ];
    },

    render: function () {
      this.model = new Backbone.Model;

      // Set page title.
      var target = this.target();
      if (!this.app.embed) {
        this.app.title('Skyline | ' + target.doc.author.username + '/'
            + (target.doc.name || target.doc.title));
      }
      this.title = _.template(header).call(this, {util: util, target: target});

      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .control-button-daily': 'daily',
      'click .control-button-weekly': 'weekly',
      'click .control-button-monthly': 'monthly',
      'click .control-button-save': 'save',
      'click .control-button-fork': 'fork',
      'click .control-button-download': 'download',
      'click .control-button-comments': 'panel',
      'click .control-button-share': 'share',
      'click .map-button': 'map',
      'mousemove .graphs': 'updateCursor',
      'mouseleave .graphs': 'hideCursor',
      'mousedown .note-button': 'note',
      'click .note-cancel-button': 'note'
    },

    setup: function () {

      // Save refs.
      this.noteDuration = this.$('.note-duration-button');
      this.sidePanel = this.$('.side-panel');
      this.mapPanel = this.$('.map-panel');
      this.mapButton = this.$('.map-button');
      this.lowerPanel = this.$('.lower-panel');
      this.controls = this.$('.controls');
      this.cursor = this.$('.cursor');
      this.noteButton = this.$('.note-button');
      this.cursorTime = $('span', this.noteButton);
      this.cursorIcon = $('i', this.noteButton);
      this.icons = this.$('.icons');
      this.saveButton = this.$('.control-button-save');
      this.saveButtonSpin = new Spin(this.$('.save-button-spin'), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6
      });

      // Handle comments panel.
      if (this.app.embed || store.get('comments')) {
        $('.side-panel').addClass('open');
      }

      var state = store.get('state');

      // Handle save button.
      if (state.author && state.author.id) {

        // This is a view, so intially it's already saved.
        this.saveButton.addClass('saved');
      }

      // Render children views.
      this.graph = new Graph(this.app, {parentView: this}).render();
      this.datasets = new Datasets(this.app, {parentView: this});
      this.comments = new Comments(this.app, {parentView: this});
      this.notes = new Notes(this.app, {parentView: this});
      this.overview = new Overview(this.app, {parentView: this}).render();
      this.map = new Map(this.app, {parentView: this}).render(this.graph.getVisibleTime());
      this.graph.bind('VisibleTimeChange', _.bind(this.map.updateVisibleTime, this.map));

      // For rendering tooltips
      this.$('.tooltip').tooltipster({delay: 600, multiple: true});
      this.noteButton.tooltipster({delay: 600, position: 'bottom'});

      if (state.time) {
        mps.publish('chart/zoom', [{min: state.time.beg/1000,
            max: state.time.end/1000}]);
      }

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

    empty: function () {
      this.$el.empty();
      return this;
    },

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
      this.map.destroy();
      delete this.map;
      this.remove();
    },

    resize: function () {
      var height = $(window).height() - this.$el.offset().top;
      this.$el.css({height: height});
      if (this.mapPanel.hasClass('open')) {
        var w = Math.floor(this.$el.width() / 2 - this.sidePanel.width());
        this.mapPanel.width(w);
        this.map.resize(w);
      }
      this.fit();
      this.graph.resize();
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
      if (this.datasets) {
        this.datasets.fit(this.$el.width() - this.controls.width());
      }
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

          // Update chart header.
          mps.publish('chart/updated', [Date.now()]);

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
      if (this.graph.model.getChannels().length > 0) {
        new Export(this.app, {parentView: this}).render();
      } else {
        mps.publish('flash/new', [{
          message: 'No data to download.',
          level: 'alert'
        }]);
      }
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
      if (e) {
        e.preventDefault();
      }
      if (this.sidePanel.hasClass('open')) {
        this.sidePanel.removeClass('open');
        store.set('comments', false);
      } else {
        this.sidePanel.addClass('open');
        store.set('comments', true);
      }
    },

    map: function (e) {
      if (e) {
        e.preventDefault();
      }
      if (this.mapPanel.hasClass('open')) {
        this.mapPanel.removeClass('open').width(0);
        $('i i', this.mapButton).removeClass('icon-angle-right')
            .addClass('icon-angle-left');
      } else {
        var w = Math.floor(this.$el.width() / 2 - this.sidePanel.width());
        this.mapPanel.addClass('open').width(w);
        $('i i', this.mapButton).removeClass('icon-angle-left')
            .addClass('icon-angle-right');
        this.map.resize(w, true);
      }
    },

    updateCursor: function (e, t) {
      if (!this.graph || this.cursor.hasClass('active')) return;
      this.cursorData = this.graph.cursor(e, t);
      if (this.cursorData.x === undefined) return;
      this.cursor.fadeIn('fast');
      this.$('.cursor-value').fadeIn('fast');
      this.cursor.css({left: Math.ceil(this.cursorData.x)});
      var time = util.toLocaleString(new Date(this.cursorData.t),
          'mmm d, yyyy h:MM:ss TT Z');
      this.cursorTime.text(time);
      this.noteButton.css({left: -this.noteButton.outerWidth()/2});

      // Draw series values.
      if (_.size(this.cursorData.points) === 0) {
        this.removeCursorValues();
        return;
      }
      _.each(this.cursorData.points, _.bind(function (p, c) {
        var id = c + '_value';
        var el = this.$('#' + id);
        if (el.length === 0) {
          el = $('<div id="' + id + '" class="cursor-value">')
              .prependTo('.graphs');
        }
        el.css({top: p.y - el.height() / 2, left: p.x + 13}).text(p.v);
      }, this));
    },

    hideCursor: function (e) {
      if (!this.cursor.hasClass('active')) {
        this.cursor.fadeOut('fast');
        this.$('.cursor-value').fadeOut('fast');
      }
      if (this.graph && this.graph.plot) {
        this.graph.plot.unhighlight();
      }
      this.map.featureOut();
    },

    note: function (e) {
      if (e) e.preventDefault();
      if (this.app.embed) return;
      if (!this.app.profile.user) return;
      if (!this.target().id) return;
      if (!this.cursorData) return;
      var tip = this.noteButton.data('tooltipsterNs')[0];

      // Designating cancel.
      if (this.cursor.hasClass('active')) {
        this.cursor.removeClass('active');
        this.cursorIcon.removeClass('icon-cancel').addClass('icon-pencil');
        this.noteButton.data(tip).Content = 'Click and drag to create a new note';
        mps.publish('note/cancel');
      
      // Start the note.
      } else {
        this.graph.$el.css({'pointer-events': 'none'});
        this.cursor.addClass('active').addClass('selecting');
        this.cursorIcon.removeClass('icon-pencil').addClass('icon-cancel');
        this.noteButton.data(tip).Content = 'Click to cancel note';
        
        mps.publish('note/start', [this.cursorData]);

        var doc = $(document);
        // debounce prevents firefox from overtriggering mousemove
        var mousemove = _.debounce(_.bind(function (e) {
          e.preventDefault();
          var current = this.graph.cursor(e);
          var dt = this.cursorData.t - current.t;
          var abs = Math.abs(dt);
          if (abs > 0) {
            var ds = util.getDuration(abs*1000, false);
            var dx = current.x - this.cursorData.x - 1;
            if (dt >= 0) {
              this.noteDuration.html('\u21A4 &nbsp;' + ds);
            } else {
              this.noteDuration.html(ds + '&nbsp; \u21A6');
              dx -= this.noteDuration.outerWidth();
            }
            this.noteDuration.css({left: dx}).show();
          } else {
            this.noteDuration.hide();
          }
          mps.publish('note/move', [this.cursorData, this.graph.cursor(e)]);
          return false;
        }, this), 1);
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
      this.cursor.removeClass('active').hide();
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

    removeCursorValues: function () {
      if (!this.graph || !this.graph.plot || !this.notes) return;
      this.$('.cursor-value').remove();
    },

    onStateChange: function (state) {
      var user = this.app.profile.user;

      // we add /chart for freeform mode, (not in a view)
      if (!this.app.profile.content.page) {
        var parts = Backbone.history.fragment.split('/');
        if (_.last(parts) !== 'chart') {
          // ensure that url routing is not broken by adding the extra param.
          this.app.router.navigate(Backbone.history.fragment + '/chart',
              {trigger: false, replace: true});
        }
      }

      // If this is explore mode, i.e. (/chart), do nothing.
      if (!state.author || !state.author.id || !user) {
        return;
      }

      // If this is a view and user is view owner, indicate state is not saved.
      if (state.author.id === user.id) {
        this.saveButton.removeClass('saved');
      }
    },

    // adds any pending channel requests, or at least one if none are open
    openRequestedChannels: function(did, channels) {
      _.each(this.requestedChannels, function (requestedChannel) {
        var found = _.find(channels, function (chn) {
          return requestedChannel === chn.channelName;
        });
        if (found) {
          mps.publish('channel/add', [did, found, true]);
        }
      });
    },

  });
});
