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
  'text!../../templates/export.html',
], function ($, _, Backbone, mps, rest, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'export',
    working: false,

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

      // Get channels.
      var datasets = this.options.parentView.datasets.collection.models;
      this.datasets = [];
      this.channels = this.graph.model.getChannels();
      _.each(this.channels, _.bind(function (c) {
        c.did = Number(c.channelName.split('__')[1]);
        var d = _.find(this.datasets, function (d) { return d.id === c.did; });
        if (!d) {
          d = _.find(datasets, function (d) { return d.id === c.did; });
          this.datasets.push({id: d.id, title: d.get('title'), num: 1});
        } else d.num++;
      }, this));

      // .map(function (channel) {

      //   // Get the parent dataset of this channel
      //   var channelTitle =  _.find(this.datasets, function(dataset) {
      //     return (dataset.id == channel.channelName.split('__')[1])
      //   }).get('title');

      //   // Handle channel name.
      //   var displayName = channelTitle === undefined ?
      //       channel.humanName: channelTitle + ':' + channel.humanName;

      //   return {
      //     channelName: channel.channelName,
      //     humanName: displayName
      //   };
      // }, this);

      // Time channels to offer.
      this.timeChannels = [
        {channelName: '$beginDate', humanName: 'Begin Date'},
        {channelName: '$beginTime', humanName: 'Begin Time'},
        {channelName: '$beginRelTime', humanName: 'Begin Since Start', units: 's'},
        {channelName: '$endRelTime', humanName: 'End Since Start', units: 's'},
      ];

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
      'click .export-form input[type="submit"]': 'export',
      // 'click .export-modal-download': 'exportCsv',
      // 'click .export-modal-fold' : 'expandModal'
    },

    // Misc. setup.
    setup: function () {
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

    // expandModal: function() {
    //   if (this.expand) {
    //     $('.export-modal-belowfold').hide();
    //     $('.export-modal-fold').text('=');
    //   }
    //   else {
    //     $('.export-modal-belowfold').show();
    //     $('.export-modal-fold').text('^^^');
    //   }
    //   this.expand = !this.expand
    //   $.fancybox.toggle();
    // },

    export: function () {

      function checkExportOk() {
        var resampling = $('[value="resample"]').is(':checked');
        var viewRange = this.graph.getVisibleTime();
        var resampleTime = Math.round(Number($('.export-resample-input').val()) * 1e6);
        var exportCount =
            Math.ceil((viewRange.end - viewRange.beg) / resampleTime);
        var maxCount = 100000;
        if (resampling && !(exportCount <= maxCount)) {
          $('.export-error-row-count').text(exportCount);
          $('.export-error-row-max').text(maxCount);
          $('.export-error').css('visibility', 'visible');
          $('.export-modal-download').addClass('disabled');
          return false;
        } else {
          $('.export-error').css('visibility', 'hidden');
          $('.export-modal-download').removeClass('disabled');
          return true;
        }
      };

      if (!checkExportOk.apply(this)) return;
      var viewRange = this.graph.getVisibleTime();
      var resample = !$('[value="noResample"]').is(':checked');
      var minmax = $('[name="minmax"]').is(':checked');
      var resampleTime = $('#resample').val();
      // TODO: calculate how many data points we'll generate with a resample,
      // and give some kind of warning or something if it's ridiculous.
      // TODO: maybe use the new download attribute on an anchor element?
      // http://html5-demos.appspot.com/static/a.download.html
      var lis = $('.export-channel-list input');
      var channelsToGet = [];
      _.each(this.channels, function (item, idx) {
        if (lis[idx].checked) channelsToGet.push(item);
      });
      var href = '/api/datasets' +
          '?beg=' + Math.floor(viewRange.beg) +
          '&end=' + Math.ceil(viewRange.end) +
          (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
          (resample && minmax ? '&minmax' : '') +
          channelsToGet.map(function (c){return '&chan=' + c.channelName}).join('');
      window.location.href = href;
    },
  });
});
