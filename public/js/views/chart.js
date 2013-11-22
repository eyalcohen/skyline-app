/*
 * Chart view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'units',
  'text!../../templates/chart.html',
  'views/lists/datasets',
  'views/lists/comments',
  'views/graph',
  'views/exportdata'
], function ($, _, Backbone, mps, util, units, template, Datasets, Comments, Graph, ExportData) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'chart',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/add', _.bind(function (did, channel) {
          this.graph.model.addChannel(this.datasets.collection.get(did), channel);
        }, this)),
        mps.subscribe('channel/remove', _.bind(function (did, channel) {
          this.graph.model.removeChannel(this.datasets.collection.get(did), channel);
        }, this)),
        mps.subscribe('view/new', _.bind(this.saved, this)),
        mps.subscribe('graph/draw', _.bind(this.updateIcons, this)),
        mps.subscribe('comment/end', _.bind(this.uncomment, this)),
      ];

      // Determine whether or not comments are allowed.
      // For now, only views can have comments...
      this.annotated = store.get('state').author_id && this.app.profile.content.page;
    },

    // Draw our template from the profile.
    render: function (samples) {

      // Use model to store view data.
      this.model = new Backbone.Model;

      // Set page title
      this.app.title('Chart');
      mps.publish('title/set', ['']);

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

      // Handle comments panel.
      if (this.annotated && store.get('comments'))
        $('.side-panel').addClass('open');

      // Render children views.
      this.graph = new Graph(this.app, {parentView: this}).render();
      this.datasets = new Datasets(this.app, {parentView: this});
      if (this.annotated)
        this.comments = new Comments(this.app, {parentView: this, type: 'view'});

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
      if (this.comments)
        this.comments.destroy();
      this.remove();
    },

    resize: function () {
      var height = $(window).height() - $('footer').height()
          - this.$el.offset().top;
      height = Math.max(height, 605);
      this.$el.css({height: height});
      this.fit();
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
      mps.publish('modal/save/open');
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
      if (!this.annotated) return;
      if (!this.graph || this.cursor.hasClass('active')) return;
      this.cursor.fadeIn('fast');
      this.cursorData = this.graph.cursor(e);
      this.cursor.css({left: this.cursorData.x});
    },

    hideCursor: function (e) {
      if (!this.annotated) return;
      if (!this.cursor.hasClass('active'))
        this.cursor.fadeOut('fast');
    },

    comment: function (e) {
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
      this.cursor.removeClass('active');
      this.graph.$el.css({'pointer-events': 'auto'});
    },

    saved: function () {
      if (this.comments) this.comments.empty();
      this.comments = new Comments(this.app, {parentView: this, type: 'view'});
      this.annotated = true;
      this.$('.control-button').removeClass('view-only');
    },

    updateIcons: function () {
      if (!this.graph || !this.comments) return;
      var xaxis = this.graph.plot.getXAxes()[0];

      // Update x-pos of each comment.
      _.each(this.comments.views, _.bind(function (v) {
        v.model.set('xpos', xaxis.p2c(v.model.get('time')));
        if (!$.contains(document.documentElement, v.icon.get(0)))
          v.icon.appendTo(this.icons);
      }, this));
    },

  });
});
