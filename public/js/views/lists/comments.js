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
      this.type = options.type;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Add parent_id.
      this.parent_id = this.app.profile.content.page.id;

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('comment/start', _.bind(this.start, this)),
        mps.subscribe('comment/end', _.bind(this.end, this)),
      ];

      // Socket subscriptions
      // this.type + '-' + this.parentView.model.id
      this.app.rpc.socket.on('comment.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('comment.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = 'No comments.';

      // Reset the collection.
      var page = this.app.profile.content.page;
      if (!page.comments) {
        page.comments_cnt = 0;
        page.comments = [];
      }
      this.collection.older = page.comments_cnt - page.comments.length;
      this.collection.reset(page.comments);
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
      this.row(model);
      this.views[this.collection.indexOf(model)].render();
      return this;
    },

    row: function (model) {
      var view = new this.Row({
        parentView: this,
        model: model
      }, this.app);
      var i = this.collection.indexOf(model);
      this.views.splice(i, 0, view);
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
      if (data.parent_id !== this.parent_id) return;
      data._new = true;
      this.collection.push(data);
    },

    // Remove a model.
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
      var w = this.inputWrap.detach();
      var i; _.find(this.collection.models, _.bind(function (m, _i) {
        i = _i;
        return m.get('time') < this.time;
      }, this));
      if (i === this.collection.length - 1)
        w.insertBefore(_.last(this.views).$el);
      else
        w.insertAfter(this.views[i].$el);
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

      this.input.val(util.sanitize(this.input.val()));
      if (this.input.val().trim() === '') return;

      // For server.
      var payload = this.form.serializeObject();
      payload.body = util.sanitize(payload.body);
      payload.parent_id = this.parent_id;
      payload.time = this.time;

      // Mock comment.
      var data = {
        id: -1,
        author: this.app.profile.user,
        body: payload.body,
        created: new Date().toISOString(),
        time: this.time,
        _new: true,
      };

      // Optimistically add comment to page.
      this.collection.push(data);
      this.input.val('').keyup();

      // Now save the comment to server.
      rest.post('/api/comments/' + this.type, payload,
          _.bind(function (err, data) {
        if (err) {
          console.log(err);
          this.collection.pop();
          return;
        }

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
