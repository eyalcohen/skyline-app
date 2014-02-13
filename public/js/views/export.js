/*
 * Export data modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/export.html',
], function ($, _, Backbone, mps, rest, util, Spin, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'export',
    maxSampleCount: 100000,

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;
      this.channels = [];

      this.expand = false;

      // Get some data from parent
      this.graph = this.options.parentView.graph;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // Gather channels.
      var datasets = this.options.parentView.datasets.collection.models;
      this.datasets = [];
      this.channels = _.clone(this.graph.model.getChannels());
      _.each(this.channels, _.bind(function (c) {
        c.did = Number(c.channelName.split('__')[1]);
        var d = _.find(this.datasets, function (d) { return d.id === c.did; });
        if (!d) {
          d = _.find(datasets, function (d) { return d.id === c.did; });
          this.datasets.push({id: d.id, title: d.get('title'), count: 1});
        } else d.count++;
      }, this));

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        modal: true
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .modal-close': 'close',
      'click .table-checkbox input': 'onChannelClick',
      'click input[name="resample"]': 'checkResample',
      'click input[name="noresample"]': 'checkNoResample',
      'click .export-form input[type="submit"]': 'export'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.resample = this.$('input[name="resample"]');
      this.noresample = this.$('input[name="noresample"]');
      this.resampleTo = this.$('.export-resample-input');
      this.downloadButtonSpin = new Spin(this.$('.button-spin'), {
        color: '#3f3f3f',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });
      this.exportError = this.$('.modal-error');

      // Handle error highlight.
      this.resampleTo.bind('keyup', function (e) {
        var t = $(e.target);
        if (t.hasClass('input-error'));
          t.removeClass('input-error');
      });

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
      this.empty();
    },

    close: function (e) {
      $.fancybox.close();
    },

    onChannelClick: function (e) {

      // Get channel.
      var target = $(e.target);
      var channel = _.find(this.channels, function (c) {
        return c.channelName === target.attr('name');
      });

      // Mark to skip.
      channel.skip = !target.is(':checked');

      // Update counts.
      var count = 0;
      _.each(this.channels, function (c) {
        if (c.did === channel.did && !c.skip)
          ++count;
      });
      var counter = this.$('.channel-cnt-' + channel.did);
      counter.text(count + ' / ' + counter.data('cnt'));
    },

    checkResample: function (e) {
      this.noresample.attr('checked', false);
      this.resample.attr('checked', true);
    },

    checkNoResample: function (e) {
      this.noresample.attr('checked', true);
      this.resample.attr('checked', false);
    },

    // TODO: calculate how many data points we'll generate with a resample,
    // and give some kind of warning or something if it's ridiculous.
    // TODO: maybe use the new download attribute on an anchor element?
    // http://html5-demos.appspot.com/static/a.download.html
    export: function (e) {
      e.preventDefault();

      // Options.
      var resample = $('[value="resample"]').is(':checked');
      var resampleTime =
          Math.round(Number(this.resampleTo.val()) * 1e6);
      var minmax = false; // FIXME

      // Check max count.
      var viewRange = this.graph.getVisibleTime();
      var exportCount =
          Math.ceil((viewRange.end - viewRange.beg) / resampleTime);
      if (resample && !(exportCount <= this.maxSampleCount)) {
        this.exportError.text('Max row count ('
            + util.addCommas(this.maxSampleCount) + ') exceeded by '
            + util.addCommas(exportCount - this.maxSampleCount) + ' rows.');
        this.resampleTo.addClass('input-error').select();
        return false;
      } else {
        this.exportError.text('');
        this.resampleTo.removeClass('input-error');
      }

      // Include time channels.
      var channels = [
        {channelName: '$beginDate', humanName: 'Begin Date'},
        {channelName: '$beginTime', humanName: 'Begin Time'},
        {channelName: '$beginRelTime', humanName: 'Begin Since Start', units: 's'},
        {channelName: '$endRelTime', humanName: 'End Since Start', units: 's'},
      ];

      // Filter channels.
      channels = channels.concat(_.reject(this.channels,
          function (c) { return c.skip; }));
      
      // Start download.
      window.location.href = '/api/datasets'
          + '?beg=' + Math.floor(viewRange.beg)
          + '&end=' + Math.ceil(viewRange.end)
          + (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '')
          + (resample && minmax ? '&minmax' : '')
          + channels.map(function (c) {
            return '&chan=' + c.channelName;
          }).join('');
    },

  });
});
