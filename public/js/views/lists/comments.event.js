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
  'text!../../../templates/lists/comments.event.html',
  'collections/comments',
  'views/rows/comment.event',
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({
    
    el: '.event-comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.type = options.type;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('comment.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('comment.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.older =
          this.parentView.model.get('comments_cnt')
          - this.parentView.model.get('comments').length;
      this.collection.reset(this.parentView.model.get('comments'));
    },

    setup: function () {

      // Save refs.
      this.footer = this.$('.list-footer');

      // Autogrow the write comment box.
      this.$('textarea[name="body"]').autogrow();
      this.$('textarea[name="body"]')
          .bind('keyup', _.bind(function (e) {
        if (e.shiftKey) return;
        if (e.keyCode === 13 || e.which === 13)
          this.write();
      }, this))
          .bind('keydown', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          return false;
      }, this));

      // Show other elements.
      this.$('.event-comments-older.event-comment').show();
      this.$('#comment_input .event-comment').show();

      return List.prototype.setup.call(this);
    },

    destroy: function () {
      // this.app.rpc.socket.removeAllListeners('comment.new');
      // this.app.rpc.socket.removeAllListeners('comment.removed');
      return List.prototype.destroy.call(this);
    },

    // Bind mouse events.
    events: {
      'click .event-comments-signin': 'signin',
      'click .event-comments-older': 'older',
    },

    // Collect new data from socket events.
    collect: function (data) {
      if (data.parent_id === this.parentView.model.id
        && !this.collection.get(-1)) {
        this.collection.push(data);
      }
    },

    // remove a model
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
        }, this));
      }
    },

    write: function (e) {
      if (e) e.preventDefault();

      var form = $('form.event-comment-input-form', this.el);
      var input = this.$('textarea.event-comment-input');
      input.val(util.sanitize(input.val()));
      if (input.val().trim() === '') return;

      // For server.
      var payload = form.serializeObject();
      payload.body = util.sanitize(payload.body);

      // Mock comment.
      var data = {
        id: -1,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString()
      };

      // Add the parent id.
      payload.parent_id = this.parentView.model.id;

      // Optimistically add comment to page.
      this.collection.push(data);
      input.val('').keyup();

      // Now save the comment to server.
      rest.post('/api/comments/' + this.type, payload,
          _.bind(function (err, data) {
        if (err) {
          this.collection.pop();
          return console.log(err);
        }

        // Update the comment id.
        var comment = this.collection.get(-1);
        comment.set('id', data.id);
        this.$('#-1').attr('id', data.id);
      }, this));

      return false;
    },

    older: function (e) {

      var limit = this.collection.older;
      this.collection.older = 0;

      // Get the older comments.
      rest.post('/api/comments/list', {
        skip: this.collection.length,
        limit: limit,
        parent_id: this.parentView.model.id,
      }, _.bind(function (err, data) {
        if (err) return console.log(err);

        // Update the collection.
        var ids = _.pluck(this.collection.models, 'id');
        this.collection.options.reverse = true;
        var i = 0;
        _.each(data.comments.items, _.bind(function (c) {
          if (!_.contains(ids, c.id)) {
            this.collection.unshift(c);
            ++i;
          }
        }, this));
        this.collection.options.reverse = false;

        // Hide the button.
        this.$('.event-comments-older.event-comment').hide();
      }, this));

    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('modal/signin/open');
    }

  });
});
