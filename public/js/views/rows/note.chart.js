/*
 * Note Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'util',
  'views/boiler/row',
  'text!../../../templates/rows/note.chart.html',
  'views/lists/replies.chart'
], function ($, _, mps, rest, util, Row, template, Replies) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'note'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // Type handling.
      if (this.model.get('parent_type') === 'view') {
        this.$el.addClass('note-view');
      } else if (this.model.get('parent_type') === 'dataset') {
        if (this.model.get('leader')) {
          this.$el.addClass('note-dataset-leader');
        } else {
          this.$el.addClass('note-dataset');
        }
      }

      // Set position.
      this.model.on('change:xpos', _.bind(function () {
        this.$el.css({
          left: Math.ceil(this.model.get('xpos'))
        });
        this.bar.css({
          opacity: this.model.get('opacity')
        }).width(Math.ceil(this.model.get('width')));
        this.wrap.css({
          left: Math.ceil(this.model.get('width')) + 2
        });
      }, this));
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-delete': 'delete',
      'click .icon-cancel': 'open',
      'click .note-bar': 'openFromParent',
      'click .note-channel': 'requestChannel',
      'mouseover .note-bar': 'over',
      'mousemove .note-bar': 'pass',
      'mousedown .note-bar': 'pass',
      'mouseup .note-bar': 'pass',
      'mousewheel .note-bar': 'pass',
      'mouseout .note-bar': 'out'
    },

    render: function (single, prepend, re) {
      Row.prototype.render.apply(this, arguments);

      // Save refs.
      this.bar = this.$('.note-bar');
      this.wrap = this.$('.note-wrap');

      // Determine if this note should be opended.
      if (this.model.id === this.app.requestedNoteId) {
        delete this.app.requestedNoteId;
        this.open();
        var dur = this.model.get('end') - this.model.get('beg');
        var min = this.model.get('beg') - 2*dur;
        var max = this.model.get('end') + 3*dur;
        _.delay(_.bind(function () {
          mps.publish('chart/zoom', [{min: min, max: max}]);
        }, this), 0);
        _.each(this.model.get('channels'), function (c) {
          mps.publish('dataset/requestOpenChannel', [c.channelName]);
        });
      } else if (single) {
        this.open();
      }

      return this;
    },

    setup: function () {

      // For rendering tooltips
      this.$('.tooltip').tooltipster({delay: 600, multiple: true});

      return Row.prototype.setup.call(this);
    },

    destroy: function () {
      if (this.replies) {
        this.replies.destroy();
      }
      return Row.prototype.destroy.call(this);
    },

    delete: function (e) {
      e.preventDefault();
      rest.delete('/api/notes/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.stopPropagation();
      e.preventDefault();
      if ($(e.target).hasClass('info-delete')) return;
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    requestChannel: function (e) {
      e.preventDefault();
      var channelName = $(e.target).data('channel');
      var did = channelName.match(/__(\d+)$/);
      if (!did) return false;
      did = Number(did[1]);
      mps.publish('channel/request', [did, channelName, function (channel) {
        if (channel) {
          mps.publish('channel/add', [did, channel.toJSON()]);
        } else {
          mps.publish('dataset/requestOpenChannel', [channelName]);
          mps.publish('dataset/select', [did]);
        }
      }]);
    },

    openFromParent: function (e) {
      this.parentView.pickBestChild(e.pageX);
    },

    open: function (e, z) {
      if (e) e.preventDefault();
      if (this.model.id === -1) return false;

      // Toggle
      if (this.replies) {
        this.replies.destroy();
        delete this.replies;
        this.wrap.hide();
        this.$el.css('z-index', 0);
        return false;
      }
      this.$el.css('z-index', z);
      this.wrap.show();
      this.$('.comment').show();

      // Get replies.
      rest.get('/api/notes/' + this.model.id, {},
          _.bind(function (err, data) {
        if (err) return console.log(err);

        // Set comments on model.
        this.model.set({
          comments: data.comments,
          comments_cnt: data.comments_cnt
        });

        // Render replies.
        this.replies = new Replies(this.app, {parentView: this});
        this.parentView.parentView.updateNotes();
      }, this));

      return false;
    },

    over: function (e) {
      e.preventDefault();
      return false;
    },

    pass: function (e) {
      if (this.parentView.parentView.graph.$el.css('pointer-events') === 'none')
        return;
      this.parentView.parentView.graph.$el.trigger(e);
    },

    out: function (e) {
      e.preventDefault();
      return false;
    },

  });
});
