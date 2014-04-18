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
  'text!../../../templates/lists/notes.html',
  'collections/notes',
  'views/rows/note'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.notes',
    selection: {beg: null, end: null},

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

      // Misc.
      this.empty_label = 'No notes.';

      this.reset(true);
    },

    // Reset the collection.
    reset: function (initial) {

      // Kill each row view.
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.views = [];

      // Gather notes.
      var notes = [];
      var notes_cnt = 0;
      var target = this.parentView.target();
      var state = store.get('state');
      if (target.type === 'view') {
        _.each(target.doc.notes, function (n) { notes.push(n); });
        notes_cnt = target.doc.notes_cnt;
      }
      _.each(this.app.profile.content.datasets.items, function (d, i) {
        if (!state.datasets[d.id] ||
            (state.datasets[d.id] && state.datasets[d.id].notes === false))
          return;
        _.each(d.notes, function (n) {
          if (i === 0) n.leader = true;
          notes.push(n);
        });
        notes_cnt += d.notes_cnt;
      });
      this.collection.older = notes_cnt - notes.length;
      this.collection.reset(notes);
    },

    // Initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      return this;
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
      this.wrap = this.$('.note-wrap');
      this.bookmarks = this.$('.note-bookmarks');
      this.selector = this.$('.note-selector');
      this.form = this.$('.comment-input-form');
      this.inputWrap = this.$('.comment-input-wrap');
      this.input = this.$('.comment-input');
      this.footer = this.$('.list-footer');

      // Autogrow the write comment box.
      this.$('textarea[name="body"]').autogrow();
      this.$('#c_cancel').click(_.bind(function (e) {
        e.preventDefault();
        // this.cancel();
        mps.publish('note/cancel');
      }, this));
      this.$('#c_submit').click(_.bind(function (e) {
        e.preventDefault();
        this.write();
      }, this));

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      'click .comments-signin': 'signin',
    },

    // Collect new notes from socket events.
    collect: function (data) {

      // Determine how to display this comment.
      var state = store.get('state');
      var target = this.parentView.target();
      if (!state.datasets) return;
      var did;
      var dataset = _.find(state.datasets, function (d, id) {
        did = Number(id);
        return did === data.parent_id
            && (d.notes === true || d.notes === undefined);
      });
      if (dataset && dataset.index === 0)
        data.leader = true;
      if (target.type === 'dataset' && !dataset) return;
      if (!dataset && target.type === 'view' && data.parent_id !== target.id) return;
      if (this.collection.get(-1)) return;
      
      // Add comment to profile.
      var owner;
      if (dataset && data.parent_type === 'dataset')
        owner = _.find(this.app.profile.content.datasets.items, function (d) {
          return did === Number(d.id);
        });
      else if (data.parent_type === 'view')
        owner = target.doc;
      if (owner) owner.notes.push(data);
        owner.notes_cnt += 1;

      // Finally, add comment.
      data._new = true;
      this.collection.push(data);
      this.parentView.updateIcons();
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
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          if (this.collection.length === 0)
            $('<span class="empty-feed">' + this.empty_label
                + '</span>').appendTo(this.$el);
        }, this));
      }

      _.each(this.app.profile.content.datasets.items, function (d) {
        d.notes = _.reject(d.notes, function (n) {
          return n.id === data.id;
        });
        d.notes_cnt = d.notes.length;
      });
    },

    // Empty this view.
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
      this.selector.css({left: data.x, right: this.selector.parent().width() - data.x}).show();
    },

    move: function (start, end) {
      var w = this.selector.parent().width();
      if (end.x > start.x)
        this.selector.css({left: Math.ceil(start.x), right: Math.ceil(w - end.x -1)})
            .removeClass('rightsided').addClass('leftsided');
      else
        this.selector.css({left: Math.ceil(end.x), right: Math.ceil(w - start.x)})
            .removeClass('leftsided').addClass('rightsided');
    },

    end: function (end) {
      this.selection.end = end.t;
      var left = parseInt(this.selector.css('left'));
      var sw = Math.ceil(this.selector.width());
      var ww = this.wrap.width();
      if (this.selection.end < this.selection.beg)
        this.wrap.css({left: left - ww - 2}).show();
      else
        this.wrap.css({left: left + sw + 1}).show();
      this.inputWrap.show();
      this.input.focus();
    },

    cancel: function () {
      this.wrap.hide();
      this.inputWrap.hide();
      this.selector.hide();
    },

    write: function (e) {
      if (e) e.preventDefault();
      var parent = this.parentView.target();
      if (!parent.id) return;

      this.input.val(util.sanitize(this.input.val()));
      if (this.input.val().trim() === '') return;

      // For server.
      var payload = this.form.serializeObject();
      payload.body = util.sanitize(payload.body);
      payload.parent_id = parent.id;
      payload.time = this.selection;

      // Mock note.
      var data = {
        id: -1,
        parent_id: payload.parent_id,
        parent_type: parent.type,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString(),
        time: this.selection
      };

      // Optimistically add note to page.
      this.collect(data);
      this.input.val('').keyup();

      console.log(payload)
      return;

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
      // this.cancel();
      mps.publish('note/cancel');

      return false;
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    }

  });
});
