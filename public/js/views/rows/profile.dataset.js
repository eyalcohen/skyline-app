/*
 * Profile Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/profile.dataset.html',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, Row, template, confirm) {
  return Row.extend({

    tagName: 'tr',

    attributes: function () {
      var klass = 'profile-dataset';
      if (this.model.get('public') === false)
        klass += ' profile-dataset-locked';
      if (this.model.get('parent'))
        klass += ' profile-dataset-fork';
      return _.defaults({class: klass},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {
      this.drawVis();
      return Row.prototype.setup.call(this);
    },

    events: {
      'click': 'navigate',
      'click .profile-item-delete': 'delete',
      'click .profile-channel-wrap': function(e) {
        this.navigate(e, e.currentTarget.id.split('profile-')[1]);
      },
      'mouseenter .main-cell-vis': function(e) {
        $(e.currentTarget).css('overflow-y', 'auto');
      },
      'mouseleave .main-cell-vis': function(e) {
        $(e.currentTarget).css('overflow-y', 'hidden');
      },
      'mouseenter .profile-channel-wrap': function(e) {
        this.$el.addClass('no-hover');
      },
      'mouseleave .profile-channel-wrap': function(e) {
        this.$el.removeClass('no-hover');
      }
    },

    navigate: function (e, channelName) {
      e.preventDefault();
      e.stopPropagation();
      if ($(e.target).hasClass('profile-item-delete')
          || $(e.target).hasClass('icon-cancel')) return;

      if ($(e.target).hasClass('navigate')) {
        var path = $(e.target).closest('a').attr('href');
        if (path) {
          $.fancybox.close();
          this.app.router.navigate(path, {trigger: true});
        }
        return;
      }

      if (!this.parentView.modal) {
        var path = [this.model.get('author').username, this.model.id].join('/');
        if (channelName)
          path += '/' + channelName
        this.app.router.navigate('/' + path, {trigger: true});
      } else {

        if (channelName)
          mps.publish('dataset/requestOpenChannel', [channelName]);

        // Add this dataset to the existing chart.
        mps.publish('dataset/select', [this.model.get('id')]);

        // Close the modal.
        $.fancybox.close();
      }
      return false;
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'I want to delete this Dataset.',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        margin: [-30,0,0,0],
        padding: 0
      });

      // Setup actions.
      $('#m_cancel').click(function (e) {
        $.fancybox.close();
      }).focus();
      $('#m_yes').click(_.bind(function (e) {

        // Delete.
        rest.delete('/api/datasets/' + this.model.id, {},
            _.bind(function (err, data) {
          if (err) return console.log(err);

          // Close the modal.
          $.fancybox.close();

        }, this));

        // Remove from UI.
        this.parentView._remove({id: this.model.id});

      }, this));

      return false;
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    drawVis: function() {

      var createSvg = function(sampleObj, selector) {

        var width = selector.width();
        var height = selector.height();

        var beg = sampleObj.range.beg || 0;
        var end = sampleObj.range.end || 0;

        if (!sampleObj.samples[0]) return
        var t_0 = sampleObj.samples[0].beg;
        var t_max = sampleObj.samples[sampleObj.samples.length-1].beg;
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
            .interpolate('linear');

        var svg = d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')
            .attr('d', path(sampleObj.samples))
            .attr('class', 'area')
            .attr('fill', '#c0c0c0')

      }

      //this.app.rpc.do('fetchSamples', this.model.id, '_schema', {}, _.bind(function (err, data) {
      rest.get('/api/datasets/' + this.model.id, _.bind(function (err, data) {

        if (err) return console.error(err);
        var channels = data.meta.channels;
        if (!channels) return console.error('No channels found');
        console.log(channels);

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

        var selector = this.$el.find('div.main-cell-vis table');

        _.each(channels, function (channel, channelIdx) {
          selector.append('<tr class="profile-channel-wrap" id="profile-'+channel.val.channelName+'"><td>' +
                          '<div class="profile-channel-name"></div>' +
                          '<div class="profile-channel-vis"></div></td></tr>')
        });

        _.each(channels, function (channel, channelIdx) {
          selector.find('.profile-channel-name').eq(channelIdx).text(channel.val.humanName);
          if (!this.parentView.modal) {
            this.app.rpc.do('fetchSamples', this.model.id, channel.val.channelName,
                            options, _.bind(function(err, samples) {
              createSvg(samples, selector.find('.profile-channel-vis').eq(channelIdx));
            }));
          }
        }, this);
      }, this));
    },

  });
});
