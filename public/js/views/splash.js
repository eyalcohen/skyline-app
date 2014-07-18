/*
 * Page view for splash.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/splash.html'
], function ($, _, Backbone, mps, util, template) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Skyline');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {
      
      // Save refs.
      this.top = this.$('.splash-top');
      this.topBottom = this.$('.splash-top-bottom');
      this.bottom = this.$('.splash-bottom');

      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      this.resize();

      // Save refs.
      // this.embedCode = this.$('.embed-code .code');
      // this.iframe = this.$('iframe');

      // Fill in the codes.
      // this.updateCodes({embed: this.iframe.attr('src').toLowerCase()});
      // graphs = [
      //   { src: "//www.skyline-data.com/embed/home/views/interest-rates-vs-economic-market-growth",
      //     img: "//s3.amazonaws.com/snapshots-skyline/views-196779199",
      //     title: "Interest Rates vs. Economic & Market Growth" },
      //   { src: "//www.skyline-data.com/embed/home/views/the-rise-of-bitcoin",
      //     img: "//s3.amazonaws.com/snapshots-skyline/views-411488850",
      //     title: "The Rise of Bitcoin" },
      //   { src: "//www.skyline-data.com/embed/home/views/streaming-san-francisco-weather",
      //     img: "//s3.amazonaws.com/snapshots-skyline/views-739824067",
      //     title: "Streaming - San Francisco Weather" },
      //   { src: "//www.skyline-data.com/embed/home/views/steroid-fueled-home-run-boom",
      //     img: "//s3.amazonaws.com/snapshots-skyline/views-1047870229",
      //     title: "Steroid Fueled Home Run Boom" },
      // ];

      // var luckyWinner = Math.floor(Math.random()*4);
      // $('.splash-select').each(function(idx) {
      //   $(this).find('img').attr('src', graphs[idx].img);
      //   $(this).find('div').text(graphs[idx].title);
      //   $(this).find('a').click(function(e) {
      //     $('.embed-chart iframe').attr('src', graphs[idx].src);
      //     $('.splash-select a').each(function(idx) { $(this).removeClass('splash-selected') });
      //     $(this).addClass('splash-selected');
      //   });
      //   if (idx === luckyWinner)
      //     $(this).find('a').click();

      // });

      return this;
    },

    events: {},

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    resize: function (e) {
      var h = $(window).height();
      this.topBottom.height(Math.max(150, h - this.topBottom.offset().top));
    },

    // updateCodes: function (data) {

    //   // Embed
    //   if (this.iframe.length > 0) this.iframe.attr('src', data.embed);
    //   this.embedCode.text('<iframe width="100%" height="100%" '
    //       + 'src="' + data.embed + '" frameborder="0"></iframe>');
    //   this.positionLabelForCode(this.embedCode);
    // },

    // positionLabelForCode: function (code) {
    //   var scrollHeight = code.get(0).scrollHeight;
    //   var padding = parseInt(code.css('padding-top'))
    //       + parseInt(code.css('padding-bottom'));
    //   code.height(scrollHeight - padding).focus().blur();
    //   $('.share-label', code.parent()).css('line-height', (scrollHeight + 1) + 'px');
    // }

  });
});
