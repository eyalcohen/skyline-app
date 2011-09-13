/*!
 * Copyright 2011 Mission Motors
 */

requirejs(['jquery', 'jquery-plugins'], function () {

  App.regions = {
    header: $('header'),
    tabs: $('.tabs-dynamic'),
    main: $('#main'),
    footer: $('footer'),
    menu: $('nav ul'),
    top: $('.dashboard .dashboard-top'),
    left: $('.dashboard .dashboard-left'),
    right: $('.dashboard .dashboard-right'),
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

  tabs.live('click', function (e) {
    if ($(e.target).hasClass('tab-closer')) {
      return;
    }
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

  $('.tab-closer').live('click', function (e) {
    var targetClass = $(e.target).parent().attr('data-tab-target');
    var targetIndex = $(e.target).parent().attr('data-tab-index');
    var tabs = $('.tab-dynamic');
    if ($(e.target).parent().hasClass('tab-active'))
      $(tabs.get(targetIndex-1)).click();
    $('.'+targetClass).remove();
    $(e.target).parent().remove();
    
    tabs = $('.tab-dynamic');
    
    var offset = 30;
    tabs.each(function (t) {
      var tab = $(tabs.get(t));
      tab.css({left:offset + 'px'});
      offset += tab.width() - 10;
    });
  });
  
  App.subscribe('NotAuthenticated', function () {
    $('.tab-closer').each(function () {
      $(this).click();
    });
    $('.tabs, .folder').hide();
  });

  // App.subscribe('UserWasAuthenticated', function () {
  //   $('.tabs, .folder').show();
  // });

  App.subscribe('VehicleRequested', openTab);

  function flipTabSides(ctx) {
    var sides = $('.tab-side img', ctx);
    sides.each(function (i) {
      var $this = $(this),
          old = $this.attr('src'),
          noo = $this.attr('alt');
      $this.attr({ src: noo, alt: old });
    });
  }
  
  function openTab(vehicleId, timeRange, validChannels, vehicleTitle) {
    var targetClass = 'target-' + makeid();
    var target = $('<div class="tab-target '+ targetClass +'">');
    var tabs = $('.tab-dynamic');
    var nextTo = $(tabs.children().get(tabs.length - 1));
    var left = nextTo.offset().left + nextTo.width();
    var tab = App.engine('tab.jade', {
      title: vehicleTitle,
      target: targetClass,
      left: left - 10,
      index: tabs.length,
    }).appendTo(App.regions.tabs).click();
    target.appendTo('.folder');
    
    // TMP
    new App.views.VehicleView({parent: targetClass}).render(arguments);
    
  }
  
  function makeid() {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for( var i=0; i < 5; i++ )
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
  }


  //TMP
  // $('[data-tab-target="preferences"]').click(function (e) {
  //   new App.collections.UserCollection().fetch();
  // });


});

