/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions.
      this.subscriptions = [
        mps.subscribe('comment/start', _.bind(this.start, this)),
        mps.subscribe('comment/end', _.bind(this.end, this)),
      ];

      // Socket subscriptions.
      this.app.rpc.socket.on('comment.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('comment.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = 'No comments.';

      this.reset(true);
    },

    // Reset the collection.
    reset: function (initial) {

      // Kill each row view.
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.views = [];

      // Gather comments.
      var comments = [];
      var comments_cnt = 0;
      var target = this.parentView.target();
      var state = store.get('state');
      if (target.type === 'view') {
        _.each(target.doc.comments, function (c) { comments.push(c); });
        comments_cnt = target.doc.comments_cnt;
      }
      _.each(this.app.profile.content.datasets.items, function (d, i) {
        if (!state.datasets[d.id] ||
            (state.datasets[d.id] && state.datasets[d.id].comments === false))
          return;
        _.each(d.comments, function (c) {
          if (i === 0) c.leader = true;
          comments.push(c);
        });
        comments_cnt += d.comments_cnt;
      });
      this.collection.older = comments_cnt - comments.length;
      this.collection.reset(comments);
    },

    // Initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length === 0)
        $('<span class="empty-feed">' + this.empty_label
            + '</span>').appendTo(this.$el);

      return this;
    },

    // Render a model, placing it in the correct order.
    renderLast: function () {
      if (this.collection.models.length === 1)
        this.$('.empty-feed').remove();
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
      this.form = this.$('.comment-input-form');
      this.inputWrap = this.$('.comment-input-wrap');
      this.input = this.$('.comment-input');
      this.footer = this.$('.list-footer');

      // Autogrow the write comment box.
      this.$('textarea[name="body"]').autogrow();
      this.$('#c_cancel').click(_.bind(function (e) {
        e.preventDefault();
        this.end();
        mps.publish('comment/end');
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

    // Collect new comments from socket events.
    collect: function (data) {

      // Determine how to display this comment.
      var state = store.get('state');
      var target = this.parentView.target();
      if (!state.datasets) return;
      var did;
      var dataset = _.find(state.datasets, function (d, id) {
        did = Number(id);
        return did === data.parent_id
            && (d.comments === true || d.comments === undefined);
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
      if (owner) owner.comments.push(data);
        owner.comments_cnt += 1;

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
        d.comments = _.reject(d.comments, function (c) {
          return c.id === data.id;
        });
        d.comments_cnt = d.comments.length;
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
      this.time = data.t;
      
      // Find out where to put the input wrapper.
      if (this.collection.length === 0) {
        this.inputWrap.show();
        this.input.focus();
        return;
      }
      var w = this.inputWrap.detach();
      var i; var v = _.find(this.views, _.bind(function (_v, _i) {
        i = _i;
        return _v.model.get('time') < this.time;
      }, this));
      if (!v && i === this.views.length - 1)
        w.insertBefore(_.last(this.views).$el);
      else
        w.insertAfter(v.$el);
      w.show();
      this.$el.parent().animate({scrollTop: w.position().top
          - this.$el.position().top},
          {duration: 400, easing: 'easeOutExpo'});
      this.input.focus();
    },

    end: function () {
      this.inputWrap.hide();
    },

    //
    // Optimistically writes a comment.
    //
    // This function assumes that a comment will successfully be created on the
    // server. Based on that assumption we render it in the UI before the 
    // success callback fires.
    //
    // When the success callback fires, we update the comment model id from the
    // comment created on the server. If the error callback fires, we remove 
    // the comment from the UI and notify the user (or retry).
    //
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
      payload.time = this.time;

      // Mock comment.
      var data = {
        id: -1,
        parent_id: payload.parent_id,
        parent_type: parent.type,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString(),
        time: this.time
      };

      // Optimistically add comment to page.
      this.collect(data);
      this.input.val('').keyup();

      // Now save the comment to server.
      rest.post('/api/comments/' + parent.type, payload,
          _.bind(function (err, data) {
        if (err) return console.log(err);

        // Update the comment id.
        var comment = this.collection.get(-1);
        comment.set('id', data.id);
        this.$('#-1').attr('id', data.id);

      }, this));

      // Done commenting.
      this.end();
      mps.publish('comment/end');

      return false;
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    }

  });
});
