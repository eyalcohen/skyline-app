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
      ]
    },

    setup: function () {

      // Save refs.
      this.button = this.$('a.dataset-button');
      this.title = this.$('.dataset-title', this.button);
      this.background = this.$('.dataset-button-bg', this.button);

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

      // Get channels for this dataset.
      this.fetchChannels();

      return Row.prototype.setup.call(this);
    },

    events: {
      'click .dataset-remove': 'delete',
    },

    fit: function (w) {
      w = w - 85;
      w = w > 200 ? 200: w;
      w = w < 60 ? 60: w;
      this.button.outerWidth(w);
      this.background.width(w + 41);
      this.fitTitle(w);
      if (this.channels) this.channels.fit();
    },

    fitTitle: function (w) {
      var txt = this.model.get('title');
      this.title.text(txt);
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
      store.set('state', state);
      return false;
    },

    fetchChannels: function () {

      // Get the schema for this channel.
      this.app.rpc.do('fetchSamples', this.model.id, '_schema',
          {}, _.bind(function (err, channels) {
        if (err) return console.error(err);
        if (!channels) return console.error('No channels found');

        // Add dataset ID to channel models.
        _.each(channels, _.bind(function (c) {
          c.did = this.model.id;
        }, this));
        
        // Create channel list.
        this.channels = new Channels(this.app, {
          items: channels,
          parentView: this
        });

        // Check if was open.
        if (store.get('state').datasets[this.model.id].open) {
          this.channels.active = true;
          this.channels.expand(true);
          this.$el.addClass('active');
        }
      }, this));
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

      var titleString =
        this.model.get('title')
        + ((offset >= 0) ? '  +' : '  -')
        + offsetAsString;

      if ((offset) == 0) {
        this.$('.dataset-title').text(this.model.get('title'));
      } else {
        this.$('.dataset-title').text(titleString);
      }
    },

  });
});
