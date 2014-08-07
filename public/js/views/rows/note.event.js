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
      var opts = {
        beginTime: channel.beg,
        endTime: channel.end,
        minDuration: (channel.end - channel.beg) / 100
      };

      this.app.rpc.do('fetchSamples', channel.did, channel.channelName,
          opts, _.bind(function (err, sampleObj) {
        if (err) {
          console.log(err);
          return;
        }

        var li = this.$('#' + channel.channelName);
        var selector = $('.event-channel-svg', li);
        var width = selector.width();
        var height = selector.height();

        var beg = sampleObj.range.beg || 0;
        var end = sampleObj.range.end || 0;

        if (!sampleObj.samples[0]) return;
        var t_0 = sampleObj.samples[0].beg;
        var t_max = sampleObj.samples[sampleObj.samples.length-1].beg;
        var t_diff = t_max - t_0;

        var v_max = _.max(_.pluck(sampleObj.samples, 'val'));
        var v_min = _.min(_.pluck(sampleObj.samples, 'val'));
        var v_diff = v_max - v_min;

        var prevEnd = null;
        var data = [];

        // Add points to deal with non-contiguous samples
        _.each(sampleObj.samples, function (s) {
          if (prevEnd != s.beg) {
            data.push({beg: prevEnd, end: prevEnd, val:v_min});
            data.push({beg: s.beg, end: s.beg, val:v_min});
          }
          data.push(s);
          prevEnd = s.end;
        });
        sampleObj.samples = data;

        var path = d3.svg.area()
            .x(function (s, i) {
              if (t_diff === 0) {
                return i === 0 ? 0: width;
              } else {
                return ((s.beg - t_0) / t_diff * width);
              }
            })
            .y0(function () {
              return height;
            })
            .y1(function (s) {
              return v_diff === 0 ? v_max: height - ((s.val - v_min) / v_diff * height);
            })
            .interpolate('linear');

        if (sampleObj.samples.length === 1) {
          sampleObj.samples.push(_.clone(sampleObj.samples[0]));
        }

        var svg = d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(sampleObj.samples))
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
