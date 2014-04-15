/*
 * Page view for profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/user',
  'text!../../templates/profile.html',
  'text!../../templates/profile.header.html',
  'views/lists/profile.datasets',
  'views/lists/profile.views',
  'd3'
], function ($, _, Backbone, mps, util, User, template, header, 
             Datasets, Views) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'profile',

    // Module entry point:
    initialize: function (app) {

      // Save app ref.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new User(this.app.profile.content.page);

      // Set page title.
      this.app.title(this.model.get('displayName')
          + ' (@' + this.model.get('username') + ')',
          _.template(header).call(this), true);

      // Render main template.
      this.template = _.template(template);
      this.$el.html(this.template.call(this)).appendTo('.main');

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Render lists.
      this.datasets = new Datasets(this.app, {
        datasets: this.app.profile.content.datasets,
        parentView: this,
        reverse: true
      });
      this.views = new Views(this.app, {
        views: this.app.profile.content.views,
        parentView: this, 
        reverse: true
      });

      this.drawVis();
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
      this.app.title();
      this.datasets.destroy();
      this.views.destroy();
      this.remove();
    },

    drawVis: function() {

      var createSvg = function(sampleObj, selector) {

        var width = selector.width();
        var height = selector.height();

        var beg = sampleObj.range.beg;
        var end = sampleObj.range.end;

        var t_0 = sampleObj.samples[0].beg;
        var t_max = sampleObj.samples[sampleObj.samples.length-1].beg
        var t_diff = t_max - t_0;

        var v_max = _.max(_.pluck(sampleObj.samples, 'val'));
        var v_min = _.min(_.pluck(sampleObj.samples, 'val'));
        var v_diff = v_max - v_min;

        var path = d3.svg.area()
            .x(function (s) {
              return ((s.beg - t_0) / (t_diff) * width);
            })
            .y0(function () {
              return height;
            })
            .y1(function (s) {
              return height - ((s.val - v_min) / (v_diff) * height);
            })
            .interpolate('step-before');

        var svg = d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(sampleObj.samples))
            .attr('class', 'area')
            .attr('fill', 'grey')

      }

      // collect sample data for each profile
      _.each(this.datasets.collection.models, function (dataset, idx) {
        this.app.rpc.do('fetchSamples', dataset.id, '_schema', {}, _.bind(function (err, data) {

          if (err) return console.error(err);
          var channels = data.samples;
          if (!channels) return console.error('No channels found');

          // Add dataset ID to channel models, and calculate dataset beg/end
          var prevBeg = Number.MAX_VALUE;
          var prevEnd = -Number.MAX_VALUE;
          _.each(channels, _.bind(function (c) {
            if (c.beg < prevBeg) prevBeg = c.beg;
            if (c.end > prevEnd) prevEnd = c.end;
          }, this));

          var options = {
            beginTime: prevBeg,
            endTime: prevEnd,
            minDuration: (prevEnd - prevBeg) / 100
          };

          var selector = $('div.main-cell-vis table').eq(idx)

          _.each(channels, function (channel, channelIdx) {
            selector.append('<tr><td><div class="profile-channel-name"></div></td>' + 
                            '<td class="profile-channel-vis"></td></tr>')
          });

          _.each(channels, function (channel, channelIdx) {
            selector.find('.profile-channel-name').eq(channelIdx).text(channel.val.humanName);
            this.app.rpc.do('fetchSamples', dataset.id, channel.val.channelName,
                            options, _.bind(function(err, samples) {
              createSvg(samples, selector.find('.profile-channel-vis').eq(channelIdx));
            }));
          }, this);
        }, this));
      }, this);
    },

  });
});
