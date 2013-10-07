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

      // Set background color.
      this.button.css({backgroundColor: this.model.color()});

      // Toggle.
      this.button.click(_.bind(this.toggle, this));

      // Get channels for this dataset.
      this.fetchChannels();

      return Row.prototype.setup.call(this);
    },

    events: {

    },

    toggle: function (e) {
      if (e) e.preventDefault();
      if (this.$el.hasClass('active')) {
        this.$el.removeClass('active');
      } else {
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
        }).render();
      }, this));
    },

    _remove: function () {
      clearInterval(this.timer);
      this.destroy();
    },

  });
});
