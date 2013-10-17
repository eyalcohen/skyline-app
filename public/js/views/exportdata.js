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
  'text!../../templates/exportdata.html',
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    className: 'exportdata',
    working: false,

    // Module entry point.
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;
      this.options = options;

      // get some data from parent
      this.graph = this.options.parentView.graph;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {
      console.log(this.channels)
      var channels = [
          { channelName: '$beginDate', title: 'Begin Date' },
          { channelName: '$beginTime', title: 'Begin Time' },
          { channelName: '$beginRelTime', title: 'Begin Since Start', units: 's' },
          { channelName: '$endRelTime', title: 'End Since Start', units: 's' },
      ].concat(this.graph.model.getChannels());

      // UnderscoreJS rendering.
      this.template = _.template(template, {channels: channels});
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
      var href = '/export/' +
          self.model.get('datasetId') + '/data.csv' +
          '?beg=' + Math.floor(viewRange.beg) +
          '&end=' + Math.ceil(viewRange.end) +
          (resample ? '&resample=' + Math.round(Number(resampleTime) * 1e6) : '') +
          (resample && minmax ? '&minmax' : '') +
          channels.map(function (c){return '&chan=' + c.channelName}).join('');
      window.location.href = href;
    },
  });
});
