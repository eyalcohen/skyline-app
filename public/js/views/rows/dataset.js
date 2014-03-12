/*
 * Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'Spin',
  'views/boiler/row',
  'text!../../../templates/rows/dataset.html',
  'views/lists/channels'
], function ($, _, mps, Spin, Row, template, Channels) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('graph/offsetChanged', _.bind(this.updateOffset, this))
      ];
    },

    setup: function () {
      console.log('SETUP');

      // Save refs.
      this.button = this.$('a.dataset-button');
      this.title = this.$('.dataset-title span', this.button);
      this.offset = this.$('.dataset-stats span', this.button);
      this.background = this.$('.dataset-button-bg', this.button);
      this.commentsButton = this.$('.dataset-control-comments');

      // Toggle.
      this.button.click(_.bind(this.toggle, this));

      // Expand / collapse.
      this.$el.bind('mouseenter', _.bind(function (e) {
        if (this.channels)
          this.channels.expand(true);
      }, this));
      this.$el.bind('mouseleave', _.bind(function (e) {
        if (this.channels) this.channels.collapse();
      }, this));

      // Handle leader.
      this.leader();

      // Get channels for this dataset.
      this.fetchChannels();

      // Update offset from store.
      var state = store.get('state');
      if (state.datasets && state.datasets[this.model.id]) {
        if (state.datasets[this.model.id].offset) {
          this.model.set('offset', state.datasets[this.model.id].offset);
          this.updateOffset();
        }
      }

      return Row.prototype.setup.call(this);
    },

    events: {
      'click .dataset-control-remove': 'delete',
      'click .dataset-control-comments': 'comments'
    },

    leader: function () {
      if (this.parentView.collection.indexOf(this.model) === 0) {
        this.model.set('leader', true);
        this.$el.addClass('leader');
      }
    },

    fit: function (w) {
      var max = this.app.embed ? 200: 235;
      w = w - 85;
      w = w > max ? max: w;
      w = w < 90 ? 90: w;
      this.button.outerWidth(w);
      this.background.width(w + 41);
      if (this.channels) this.channels.fit();
      this.updateOffset();
      this.fitTitle(w - (this.app.embed ? 0: 70));
      this.leader();
    },

    fitTitle: function (w) {
      var txt = this.title.text();
      var tw = this.title.outerWidth();
      if (tw >= w) {
        var len = txt.length;
        var i = 1;
        while (tw >= w) {
          this.title.text(txt.substr(0, len - i) + '...');
          tw = this.title.outerWidth();
          ++i;
        }
      }
    },

    toggle: function (e) {
      if (e) e.preventDefault();
      var state = store.get('state');
      if (this.$el.hasClass('active')) {
        if (this.channels) this.channels.active = false;
        this.$el.removeClass('active');
        state.datasets[this.model.id].open = false;
      } else {
        if (this.channels)
          this.channels.active = true;
        this.$el.addClass('active');
        state.datasets[this.model.id].open = true;
      }
      this.app.state(state);
      return false;
    },

    fetchChannels: function () {
      console.log('FETCH CHANNELS');

      // Get the schema for this channel.
      this.app.rpc.do('fetchSamples', this.model.id, '_schema', {},
          _.bind(function (err, data) {
        console.log(err, data);
        if (err) return console.error(err);
        var channels = data.samples;
        if (!channels) return console.error('No channels found');

        // Add dataset ID to channel models, and calculate dataset beg/end
        var prevBeg = Number.MAX_VALUE;
        var prevEnd = -Number.MAX_VALUE;
        _.each(channels, _.bind(function (c) {
          if (c.beg < prevBeg) prevBeg = c.beg;
          if (c.end > prevEnd) prevEnd = c.end;
          c.did = this.model.id;
        }, this));

        this.model.set('beg', prevBeg);
        this.model.set('end', prevEnd);

        // Create channel list.
        console.log(channels)
        this.channels = new Channels(this.app, {
          items: channels,
          parentView: this
        });

        // Check if was open.
        var state = store.get('state');
        var did = this.model.id;
        if (!this.app.embed && state.datasets && state.datasets[did]
            && state.datasets[did].open) {
          this.channels.active = true;
          this.channels.expand(true);
          this.$el.addClass('active');
          state.datasets[did].open = true;
          store.set('state', state);
        }

        // Check if comments off.
        if (state.datasets && state.datasets[did]
            && state.datasets[did].comments === false) {
          this.commentsButton.addClass('off');
        }
      }, this));
    },

    comments: function (e) {
      e.preventDefault();
      var state = store.get('state');
      var did = this.model.id;
      if (state.datasets && state.datasets[did]) {
        state.datasets[did].comments =
            state.datasets[did].comments === undefined
            || state.datasets[did].comments === true ? false: true;
        this.app.state(state);
      }
      mps.publish('comments/refresh');
      if (this.commentsButton.hasClass('off'))
        this.commentsButton.removeClass('off');
      else this.commentsButton.addClass('off');
    },

    delete: function (e) {
      if (e) e.preventDefault();
      this.parentView._remove({id: this.model.id});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.channels) this.channels.destroy();
      return Row.prototype.destroy.call(this);
    },

    _remove: function (cb) {
      this.$el.fadeOut('fast', _.bind(function () {
        this.destroy();
        if (cb) cb();
      }, this));
    },

    updateOffset: function() {

      // Save new offset
      var state = store.get('state');
      var did = this.model.id;
      if (state.datasets && state.datasets[did]
          && state.datasets[did].offset !== this.model.get('offset')) {
        var initial = state.datasets[did].offset === undefined
            && this.model.get('offset') === 0;
        state.datasets[did].offset = this.model.get('offset');
        if (!initial)
          this.app.state(state);
      }

      var offset = this.model.get('offset')
      var offset_abs = Math.abs(Math.round(offset/1000));
      var offsetAsString =
        (offset_abs < 1000) ? offset_abs + 'ms' :
        (offset_abs < 1000*60) ? Math.round(offset_abs / 1000) + 's' :
        (offset_abs < 1000*60*60) ? (offset_abs / (1000*60)).toFixed(1) + 'm' :
        (offset_abs < 1000*60*60*24) ? (offset_abs / (1000*60*60)).toFixed(1) + 'h' :
        (offset_abs < 1000*60*60*24*7) ? (offset_abs / (1000*60*60*24)).toFixed(1) + 'Dy' :
        (offset_abs < 1000*60*60*24*7*4) ? (offset_abs / (1000*60*60*24*7)).toFixed(1) + 'Wk' :
        (offset_abs < 1000*60*60*24*7*4*12) ? (offset_abs / (1000*60*60*24*7*4)).toFixed(1) + 'Mo' :
        (offset_abs / (1000*60*60*24*7*4*12)).toFixed(1) + 'Yr';
        offset_abs;
      var titleString = ((offset >= 0) ? '  +' : '  -') + offsetAsString;

      if (offset !== 0)
        this.offset.text(', Offset ' + titleString);
      else
        this.offset.text('');
    },

  });
});
