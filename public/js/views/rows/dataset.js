/*
 * Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/dataset.html',
  'views/lists/channels',
  'Spin'
], function ($, _, mps, Row, template, Channels, Spin) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'dataset'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {

      // Save refs.
      this.button = this.$('a.dataset-button');

      // Toggle.
      this.button.click(_.bind(this.toggle, this));

      // Expand / collapse.
      this.$el.bind('mouseenter', _.bind(function (e) {
        if (this.channels) {
          this.channels.$el.show();
          this.channels.expand(true);
        }
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

    toggle: function (e) {
      if (e) e.preventDefault();
      if (this.$el.hasClass('active')) {
        if (this.channels) this.channels.active = false;
        this.$el.removeClass('active');
      } else {
        if (this.channels)
          this.channels.active = true;
        this.$el.addClass('active');
      }
      return false;
    },

    fetchChannels: function () {
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
      }, this));
    },

    delete: function (e) {
      if (e) e.preventDefault();
      this.parentView._remove({id: this.model.id});
    },

    destroy: function () {
      this.channels.destroy();
      mps.publish('chart/datasets/remove', [this.model.id]);
      return Row.prototype.destroy.call(this);
    },

    _remove: function (cb) {
      this.$el.fadeOut('fast', _.bind(function () {
        this.destroy();
        if (cb) cb();
      }, this));
    },

  });
});
