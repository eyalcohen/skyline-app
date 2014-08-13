/*
 * Notes List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/notes.chart.html',
  'collections/notes',
  'views/rows/note.chart'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.chart-notes',
    selection: {beg: null, end: null},
    latestNoteZ: 0,
    requestedNotes: [],

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions.
      this.subscriptions = [
        mps.subscribe('note/start', _.bind(this.start, this)),
        mps.subscribe('note/move', _.bind(this.move, this)),
        mps.subscribe('note/end', _.bind(this.end, this)),
        mps.subscribe('note/cancel', _.bind(this.cancel, this)),
      ];

      // Socket subscriptions.
      this.app.rpc.socket.on('note.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('note.removed', _.bind(this._remove, this));

      this.reset(true);
    },

    // Reset the collection.
    reset: function (initial) {
      var target = this.parentView.target();
      var state = store.get('state');

      function _gather() {
        var notes = [];
        if (target.type === 'view') {
          _.each(target.doc.notes, function (n) {
            n.parent = target.doc;
            notes.push(n);
          });
        }
        _.each(this.app.profile.content.datasets.items, function (d, i) {
          if (!state.datasets[d.id] ||
              (state.datasets[d.id] && state.datasets[d.id].notes === false))
            return;
          _.each(d.notes, function (n) {
            n.parent = d;
            if (i === 0) n.leader = true;
            notes.push(n);
          });
        });
        return notes;
      }

      if (this.views.length === 0) {
        this.collection.reset(_gather.call(this));
      } else {

        // Validate old views.
        var reject = [];
        var dids = _.map(_.keys(state.datasets),function (k) {
          return Number(k);
        });
        var vid = state.id ? Number(state.id): null;
        _.each(this.views, function (v) {
          var pid = v.model.get('parent_id');
          if (!_.contains(dids, pid) && pid !== vid) {
            reject.push(v);
          }
        });
        _.each(reject, _.bind(function (v) {
          this._remove(v.model)
        }, this));

        // Add new raw notes (from a new dataset).
        var notes = _gather.call(this);
        _.each(notes, _.bind(function (n) {
          var exists = _.find(this.views, function (v) {
            return v.model.id === n.id;
          });
          if (!exists) {
            n._new = true;
            this.collection.push(n);
          }
        }, this));

      }
    },

    // Render a model, placing it in the correct order.
    renderLast: function () {
      var model = _.find(this.collection.models, _.bind(function (m) {
        return m.get('_new');
      }, this));
      model.set('_new', false);
      this.row(model, true);
      return this;
    },

    row: function (model, single) {
      var view = new this.Row({
        parentView: this,
        model: model
      }, this.app);
      if (single) view.render(true);
      this.views.push(view);
      this.views.sort(function (a, b) {
        return b.model.get('time') - a.model.get('time');
      });

      return view.toHTML();
    },

    setup: function () {

      // Save refs.
      this.selector = this.$('.note-selector');
      this.wrap = this.$('.note-wrap-new');
      this.form = $('.comment-input-form', this.wrap);
      this.input = this.$('.comment-input', this.wrap);

      // Handle comment box keys.
      this.$('textarea[name="body"]')
          .bind('keyup', _.bind(function (e) {
        if (e.shiftKey) return;
        if (e.keyCode === 13 || e.which === 13)
          this.write();
        else if (e.keyCode === 27 || e.which === 27)
          mps.publish('note/cancel');
      }, this))
          .bind('keydown', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          return false;
      }, this)).autogrow();

      return List.prototype.setup.call(this);
    },

    events: {
      'click .navigate': 'navigate',
    },

    // Collect new notes from socket events.
    collect: function (data) {

      // Determine how to display this note.
      var state = store.get('state');
      var target = this.parentView.target();
      if (!state.datasets) return;
      var did;
      var dataset = _.find(state.datasets, function (d, id) {
        did = Number(id);
        return did === data.parent_id
            && (d.notes === true || d.notes === undefined);
      });
      if (dataset && dataset.index === 0) {
        data.leader = true;
      }
      if (target.type === 'dataset' && !dataset) return;
      if (!dataset && target.type === 'view' && data.parent_id !== target.id) return;
      if (this.collection.get(-1)) return;

      // Finally, add note.
      data._new = true;
      this.collection.push(data);
    },

    // Remove a model.
    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view.destroy();
        this.collection.remove(view.model);
      }
    },

    empty: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.undelegateEvents();
      this.stopListening();
      this.$el.empty();
      return this;
    },

    start: function (data) {
      this.selection.beg = data.t;
      this.selector.css({
        left: data.x, 
        right: this.selector.parent().width() - data.x
      }).show();
    },

    move: function (start, end) {
      var w = this.selector.parent().width();
      if (end.x > start.x)
        this.selector.css({left: Math.ceil(start.x) - 1, right: Math.ceil(w - end.x)})
            .removeClass('rightsided').addClass('leftsided');
      else
        this.selector.css({left: Math.ceil(end.x), right: Math.ceil(w - start.x) - 1})
            .removeClass('leftsided').addClass('rightsided');
    },

    end: function (end) {
      this.selection.end = end.t;
      var w = this.selector.parent().width();
      var left = parseInt(this.parentView.cursor.css('left'));
      var sw = Math.ceil(this.selector.outerWidth());
      var ww = this.wrap.outerWidth();
      var p, pan;
      if (this.selection.end >= this.selection.beg) {
        this.wrap.removeClass('rightsided').addClass('leftsided');
        p = this.selection.end === this.selection.beg ?
            left + 1: left + sw - 1;

        // Ensure wrap will be entirely on screen.
        if (p > w - ww) pan = ww - (w - p) + 20;
      } else {
        this.wrap.removeClass('leftsided').addClass('rightsided');
        var beg = this.selection.beg;
        this.selection.beg = this.selection.end;
        this.selection.end = beg;
        p = left - sw - ww + 1;

        // Ensure wrap will be entirely on screen.
        if (p < 0) pan = p - 20;
      }
      if (pan) {
        mps.publish('chart/pan', [pan]);
        this.selector.css({
          left: parseInt(this.selector.css('left')) - pan,
          right: parseInt(this.selector.css('right')) + pan
        });
        this.parentView.cursor.css({
          left: parseInt(this.parentView.cursor.css('left')) - pan
        });
      } else {
        pan = 0;
      }
      this.wrap.css({left: p - pan}).show();
      this.input.focus();
    },

    cancel: function () {
      this.wrap.hide();
      this.selector.hide();
    },

    write: function (e) {
      if (e) e.preventDefault();
      var parent = this.parentView.target();
      if (!parent.id) return;

      // Get channels under note.
      var channels = _.map(this.parentView.graph.getChannelsInBounds(
          this.selection.beg, this.selection.end), function (c) {
        return {
          channelName: c.channelName, 
          humanName: c.humanName,
          did: c.parent_id,
          username: c.author.username
        };
      });

      this.input.val(util.sanitize(this.input.val()));
      if (this.input.val().trim() === '') return;

      // For server.
      var payload = this.form.serializeObject();
      payload.body = util.sanitize(payload.body);
      payload.parent_id = parent.id;
      payload.beg = this.selection.beg;
      payload.end = this.selection.end;
      payload.channels = channels;

      // Mock note.
      var data = {
        id: -1,
        parent: parent.doc,
        parent_id: payload.parent_id,
        parent_type: parent.type,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString(),
        beg: this.selection.beg,
        end: this.selection.end,
        channels: channels,
      };

      // Optimistically add note to page.
      this.collect(data);
      this.input.val('').keyup();

      // Now save the note to server.
      rest.post('/api/notes/' + parent.type, payload,
          _.bind(function (err, data) {
        if (err) return console.log(err);

        // Update the note id.
        var note = this.collection.get(-1);
        note.set('id', data.id);
        this.$('#-1').attr('id', data.id);
      }, this));

      // Done noting.
      mps.publish('note/cancel');

      return false;
    },

    pickBestChild: function (x) {
      var picks = [];
      var pick;

      // Find views containing x.
      _.each(this.views, function (v) {
        var x1 = Math.floor(v.model.get('xpos'));
        var x2 = Math.ceil(x1 + v.model.get('width')) + 2;
        if (x >= x1 && x <= x2)
          picks.push(v);
      });
      
      // Choose narrowest one.
      var minWidth = Number.MAX_VALUE;
      _.each(picks, function (v) {
        var w = v.model.get('width');
        if (w < minWidth) {
          minWidth = w;
          pick = v;
        }
      });

      if (pick) {
        pick.open(null, ++this.latestNoteZ);
      }
    },

    navigate: function (e) {
      e.stopPropagation();
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
