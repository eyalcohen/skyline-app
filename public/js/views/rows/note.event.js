/*
 * Note event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/note',
  'text!../../../templates/rows/note.event.html',
  'views/lists/comments'
], function ($, _, Backbone, mps, util, Model, template, Comments) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-note'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model);
      this.parentView = options.parentView;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      // Socket subscriptions.
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.$el.html(this.template.call(this, {util: util}));
      this.$el.prependTo(this.parentView.$('.event-right'));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Render lists.
      this.comments = new Comments(this.app, {parentView: this, type: 'note'});

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        this.drawChannel(c);
      }, this));

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // For rendering tooltips
      this.parentView.$('.tooltip').tooltipster({delay: 600, multiple: true});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.comments) {
        this.comments.destroy();
      }
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    removeChannel: function (data) {
      var li = $('li[data-id=' + data.id + ']').remove();
    },

    drawChannel: function(channel) {
      var li = this.$('#' + channel.channelName);
      var selector = $('.event-channel-svg', li);
      var width = selector.width();
      var height = selector.height();

      this.app.cache.fetchSamples(channel.channelName, channel.beg, channel.end,
          width, _.bind(function(samples) {

        selector.empty();

        var t_0 = samples[0].time;
        var t_max = _.last(samples).time;
        var t_diff = t_max - t_0;

        var v_max = _.max(_.pluck(samples, 'avg'));
        var v_min = _.min(_.pluck(samples, 'avg'));
        var v_diff = v_max - v_min;

        var path = d3.svg.area()
            .x(function (s, i) {
              if (t_diff === 0) {
                return i === 0 ? 0: width;
              } else {
                return ((s.time - t_0) / t_diff * width);
              }
            })
            .y0(function () {
              return height;
            })
            .y1(function (s) {
              return v_diff === 0 ? v_max: height - ((s.avg - v_min) / v_diff * height);
            })
            .interpolate('linear');

        d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(samples))
            .attr('class', 'area')
            .attr('fill', '#000000');
      }, this));
    },
    
    when: function () {
      if (!this.model.get('created')) {
        return;
      }
      if (!this.time) {
        this.time = this.$('time.created:first');
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
