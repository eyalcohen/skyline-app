/*
 * Export data modal view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rest',
  'util',
  'Spin',
  'collections/datasets',
  'text!../../templates/exportdata.html',
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, Collection, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'exportdata',
    working: false,

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;
      this.channels = [];

      // get some data from parent
      this.graph = this.options.parentView.graph;
      this.datasets = this.options.parentView.datasets.collection.models;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {
      var graphedChannels = this.graph.model.getChannels().map( function (channelObj) {
        // get the parent dataset of this channel
        var channelTitle =  _.find(this.datasets, function(dataset) {
          return (dataset.id == channelObj.channelName.split('__')[1])
        }).attributes.title

        if (channelTitle === undefined)
          displayName = channelObj.humanName;
        else
          displayName = channelTitle + ':' + channelObj.humanName;

        return {
          channelName: channelObj.channelName,
          humanName: displayName
        }
      }, this);
      this.channels = [
          { channelName: '$beginDate', humanName: 'Begin Date' },
          { channelName: '$beginTime', humanName: 'Begin Time' },
          { channelName: '$beginRelTime', humanName: 'Begin Since Start', units: 's' },
          { channelName: '$endRelTime', humanName: 'End Since Start', units: 's' },
      ].concat(graphedChannels);
      // UnderscoreJS rendering.
      this.template = _.template(template, {channels: this.channels});
      this.$el.html(this.template)
      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Add placeholder shim if need to.
      if (Modernizr.input.placeholder)
        this.$('input').placeholder();

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #download-data': 'exportCsv'
    },

    // Misc. setup.
    setup: function () {
      console.log('rendered')
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

    exportCsv: function () {

      function checkExportOk() {
      /*
        var resampling = $('[value="resample"]').is(':checked');
        var viewRange = this.graph.getVisibleTime();
        var resampleTime = Math.round(Number($('#resample').val()) * 1e6);
        var exportCount =
            Math.ceil((viewRange.end - viewRange.beg) / resampleTime);
        var maxCount = 100000;
        if (resampling && !(exportCount <= maxCount)) {
          $('#rowCount').text(self.addCommas(exportCount));
          $('#rowMax').text(self.addCommas(maxCount));
          $('#exportError').css('visibility', 'visible');
          $('#download-data').addClass('disabled');
          return false;
        } else {
          $('#exportError').css('visibility', 'hidden');
          $('#download-data').removeClass('disabled');
          return true;
        }
        */
        return true;
      };


      if (!checkExportOk()) return;
      var viewRange = this.graph.getVisibleTime();
      var resample = !$('[value="noResample"]').is(':checked');
      var minmax = $('[name="minmax"]').is(':checked');
      var resampleTime = $('#resample').val();
      // TODO: calculate how many data points we'll generate with a resample,
      // and give some kind of warning or something if it's ridiculous.
      // TODO: maybe use the new download attribute on an anchor element?
      // http://html5-demos.appspot.com/static/a.download.html
      // We should really fetch the data via dnode then force the download
      // client-side... this way we can show a loading icon while the
      // user waits for the server to package everything up.
      var href = '/api/datasets' +
          '?beg=' + Math.floor(viewRange.beg) +
          '&end=' + Math.ceil(viewRange.end) +
          (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
          (resample && minmax ? '&minmax' : '') +
          this.channels.map(function (c){return '&chan=' + c.channelName}).join('');
      window.location.href = href;
    },
  });
});
