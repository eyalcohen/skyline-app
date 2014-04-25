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
      this.subscriptions = [];

      // Socket subscriptions.
      this.app.rpc.socket.on('comment.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('comment.removed', _.bind(this._remove, this));

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
      } else {
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
      }
      this.collection.older = comments_cnt - comments.length;
      this.collection.reset(comments);
    },

    setup: function () {

      // Save refs.
      this.form = this.$('.comment-input-form');
      this.input = this.$('.comment-input');
      this.footer = this.$('.list-footer');

      // Handle comment box keys.
      this.$('textarea[name="body"]')
          .bind('keyup', _.bind(function (e) {
        if (e.shiftKey) return;
        if (e.keyCode === 13 || e.which === 13)
          this.write();
      }, this))
          .bind('keydown', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          return false;
      }, this)).autogrow();

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
      'click .comments-signin': 'signin',
      'click .comments-older': 'older',
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

      // Mock comment.
      var data = {
        id: -1,
        parent_id: payload.parent_id,
        parent_type: parent.type,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString()
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

      return false;
    },

    older: function (e) {
      var parent = this.parentView.target();
      var limit = this.collection.older;
      this.collection.older = 0;

      // Get the older comments.
      rest.post('/api/comments/list', {
        skip: this.collection.length,
        limit: limit,
        type: parent.type,
        parent_id: parent.id,
      }, _.bind(function (err, data) {
        if (err) return console.log(err);

        // Update the collection.
        var ids = _.pluck(this.collection.models, 'id');
        this.collection.options.reverse = true;
        var i = 0;
        _.each(data.comments.items, _.bind(function (c) {
          c.leader = true;
          if (!_.contains(ids, c.id)) {
            this.collection.unshift(c);
            ++i;
          }
        }, this));
        this.collection.options.reverse = false;

        // Hide the button.
        this.$('.comments-older.comment').remove();
      }, this));

    },

    navigate: function (e) {
      e.stopPropagation();
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    }

  });
});
