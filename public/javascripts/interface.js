/*!
 * Copyright 2011 Mission Motors
 */

requirejs(['jquery', 'jquery-plugins'], function () {

  App.regions = {
    header: $('header'),
    main: $('#main'),
    footer: $('footer'),
    menu: $('nav ul'),
    top: $('.dashboard-top'),
    left: $('.dashboard-left'),
    right: $('.dashboard-right'),
  };
  
  $(window).resize($.debounce(250, function (e) {
    App.publish('WindowResize');
    var win = $(this);
  }));

  // TABS
  var tabs = $('.tab');
  tabs.each(function (i) {
    $this = $(this);
    var z = $this.hasClass('tab-active') ?
      10001 + tabs.length - i :
      tabs.length - i;
    $this.css({ zIndex: z });
  });

  tabs.live('click', function () {
    var $this = $(this);
    $('.tab-active').each(function (i) {
      var $this = $(this);
      $this.removeClass('tab-active');
      $this.css({ zIndex: parseInt($this.css('z-index')) - 10001 });
      flipTabSides($this);
      $('.tab-content', $this).addClass('tab-content-inactive');
    });
    $this.addClass('tab-active');
    $this.css({ zIndex: 10001 + parseInt($this.css('z-index')) });
    flipTabSides($this);
    $('.tab-content', $this).removeClass('tab-content-inactive');

    // show and hide content
    var target = $('.' + $this.attr('data-tab-target'));
    if (target.is(":visible")) {
      return;
    }
    $('.tab-target').hide();
    target.show();
  });

  function flipTabSides(ctx) {
    var sides = $('.tab-side img', ctx);
    sides.each(function (i) {
      var $this = $(this),
          old = $this.attr('src'),
          noo = $this.attr('alt');
      $this.attr({ src: noo, alt: old });
    });
  }

});

