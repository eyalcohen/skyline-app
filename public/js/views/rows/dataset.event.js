/*
 * Dataset event view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/dataset',
  'text!../../../templates/rows/dataset.event.html',
  'text!../../../templates/dataset.header.html',
  'views/lists/comments',
  'views/lists/notes',
  'text!../../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Model, template, header, Comments, Notes, confirm) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'event-dataset'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.config = options.config;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);

      // Socket subscriptions.
      this.app.rpc.socket.on('channel.removed', _.bind(this.removeChannel, this));

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'change .dataset-param': 'save',
      'click .demolish': 'demolish',
      'click .event-channel-delete': 'deleteChannel',
      'change .event-channel-input': 'saveChannel',
      'change .event-unit-input': 'saveChannel',
      'click .save-private': 'checkPrivate'
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this, {util: util}));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
      }

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Skyline | ' + this.model.get('title'));

        // Render title.
        this.title = _.template(header).call(this, {util: util});
      }

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Save field contents on blur.
      if (this.config) {
        this.privateButton = this.$('.save-private');

        // Show greeting.
        this.$('.config-greeting').show();
      }

      // Render lists.
      if (!this.config) {
        this.comments = new Comments(this.app,
            {parentView: this, type: 'dataset'});
        if (!this.parentView) {
          this.notes = new Notes(this.app,
              {parentView: this, sort: 'created', reverse: true});
        }
      }

      // Draw SVG for each channel.
      _.each(this.model.get('channels'), _.bind(function (c) {
        this.drawChannel(c);
      }, this));

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // For rendering tooltips
      if (this.parentView) {
        this.parentView.$('.tooltip').tooltipster({delay: 600, multiple: true});
      }
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.comments) {
        this.comments.destroy();
      }
      if (this.notes) {
        this.notes.destroy();
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
      if ($(e.target).hasClass('event-channel-delete')
          || $(e.target).hasClass('event-channel-input')
          || $(e.target).hasClass('event-unit-input')
          || $(e.target).hasClass('icon-cancel')) {
        return;
      }
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    // Save the field.
    save: function (e) {
      var field = $(e.target);
      var name = field.attr('name');
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Now do the save.
      rest.put('/api/datasets/' + this.model.id, payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Save the saved state and show indicator.
        field.data('saved', val);
        
        // Show saved status.
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);

      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this dataset?',
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

        // Delete the user.
        rest.delete('/api/datasets/' + this.model.id,
            {}, _.bind(function (err) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error'}]);
            return false;
          }

          // Route to home.
          if (!this.parentView) {
            this.app.router.navigate('/', {trigger: true});
          }

          // Close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

    deleteChannel: function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this channel?',
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
      $('.modal-confirm').click(_.bind(function () {

        // Delete the doc.
        var li = $(e.target).closest('li');
        rest.delete('/api/channels/' + li.data('id'),
            {}, _.bind(function (err, data) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error'}]);
            return false;
          }
          li.remove();

          // Close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
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
      this.app.rpc.do('fetchSamples', this.model.id, channel.channelName,
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

    saveChannel: function (e) {
      var field = $(e.target);
      var name = field.data('param');
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Now do the save.
      rest.put('/api/channels/' + field.attr('id'), payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Save the saved state and show indicator.
        field.data('saved', val);
        
        // Show saved status.
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);

      }, this));

      return false;
    },

    checkPrivate: function (e) {
      if (this.privateButton.hasClass('disabled')) return;
      var span = $('span', this.privateButton.parent());
      var payload = {};
      if (this.privateButton.is(':checked')) {
        span.html('<i class="icon-lock"></i> Private');
        payload.public = false;
      } else {
        span.html('<i class="icon-lock-open"></i> Public');
        payload.public = true;
      }

      // Now do the save.
      rest.put('/api/datasets/' + this.model.id, payload,
          _.bind(function (err) {
        if (err) {
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);
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
