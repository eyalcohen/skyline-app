/*
 * View event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/view',
  'text!../../../templates/rows/view.event.html',
  'views/lists/comments.event',
  'text!../../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Model, template, Comments, confirm) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-view'};
      if (this.model) attrs.id = this.model.id;
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.template = _.template(template);

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-delete': 'delete'
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this));
      this.$el.prependTo(this.parentView.$('.event-right'));

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'view'
      });

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        this.drawChannel(c);
      }, this));

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      if (this.timer)
        clearInterval(this.timer);
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this view forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the doc.
        rest.delete('/api/views/' + this.model.id,
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

    removeChannel: function (data) {
      var li = $('li[data-id=' + data.id + ']').remove();
    },

    when: function () {
      if (!this.model.get('created')) return;
      if (!this.time)
        this.time = this.$('time.created:first');
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

    drawChannel: function(channel) {
      var opts = {
        beginTime: channel.beg,
        endTime: channel.end,
        minDuration: (channel.end - channel.beg) / 100
      };
      var lineOpts = this.model.get('lineStyleOptions');
      this.app.rpc.do('fetchSamples', Number(channel.parent_id), channel.channelName,
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

        var color = lineOpts && lineOpts[channel.channelName] ?
            lineOpts[channel.channelName].color: null;
        if (!color) {
          if (channel.colorNum !== undefined) {
            color = this.app.colors[channel.colorNum];
          } else {
            color = '#3f3f3f';
          }
        }
        var svg = d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(sampleObj.samples))
            .attr('class', 'area')
            .attr('fill', color);
      }, this));
    },

  });
});