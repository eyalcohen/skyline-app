/*
 * Channels view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../../templates/channels.html'
], function ($, _, Backbone, mps, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#channels > div',

    // Module entry point:
    initialize: function (app, options) {

      // Save app ref.
      this.app = app;
      this.options = options;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function (samples) {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click li:not(.dataset-head)': 'channelClick',
      'click li.dataset-head': 'datasetClick',
    },

    // Misc. setup.
    setup: function () {

      // Add datasets from profile JSON.
      this.renderDataset(this.app.profile.content.page, true);
      this.fetchChannels(this.app.profile.content.page);
      if (this.app.profile.content.datasets.items.length > 0) {
        _.each(this.app.profile.content.datasets.items, _.bind(function (ds) {
          this.renderDataset(ds);
          this.fetchChannels(ds)
        }, this));
        this.$('.channels-separator').show();
      }

      return this;
    },

    fetchChannels: function (dataset) {
      this.app.rpc.do('fetchSamples', Number(dataset.id), '_schema',
          {}, _.bind(function (err, samples) {
        if (err) return console.error(err);
        if (!samples) return console.error('No _schema samples found');
        _.each(samples, _.bind(function (schema, i) {
          this.renderChannel(dataset, schema);
        }, this));
      }, this));
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
      this.remove();
    },

    renderDataset: function (dataset, main) {
      var ul = $('<ul id="' + dataset.id + '"></ul>');
      var li = $('<li class="dataset-head">' +
          dataset.title + '</li>').appendTo(ul);
      li.data('dataset', dataset);
      if (main) {
        li.hide();
        ul.css('margin-top', '15px');
        $('<div class="channels-separator">Other Datasets\' Channels</div>')
            .insertAfter(ul);
      }
      ul.appendTo(this.$el).show();
    },

    renderChannel: function (dataset, channel) {
      var li = $('<li>' + _.str.strLeft(channel.val.channelName, '__') + '</li>');
      li.data('channel', channel);
      li.data('dataset', dataset);
      li.appendTo(this.$('ul#' + dataset.id));
    },

    channelClick: function (e) {
      var li = $(e.target);
      if (li.hasClass('active')) {
        li.removeClass('active');
        this.options.parentView.graph.model.removeChannel(
          Number(li.data('dataset').id),
          li.data('channel').val
        );
      } else {
        li.addClass('active');
        this.options.parentView.graph.model.addChannel(
          Number(li.data('dataset').id),
          li.data('channel').val
        );
      }
    },

    datasetClick: function (e) {
      var dataset = $(e.target).data('dataset');

      // Route to this dataset.
      this.app.router.navigate('/' + dataset.author.username
          + '/' + dataset.id, {trigger: true});
    },

  });
});

