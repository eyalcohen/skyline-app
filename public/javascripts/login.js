/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define(['jquery', 'style', 'async!http://maps.google.com/maps/api/js?'+
    'libraries=geometry&sensor=false!callback', 'jquery-plugins'],
    function ($, style) {
  $(function () {

    // save the login form
    var loginForm = $('#login-form');

        // login user
        loginButton = $('#login'),
        loginEmail = $('input[name="user[email]"]'),
        loginPassword = $('input[name="user[password]"]'),
        loginEmailLabel = $('label[for="user[email]"]'),
        loginPasswordLabel = $('label[for="user[password]"]'),

        // reports
        landingMessage = $('#landing-message'),
        landingSuccess = $('#landing-success'),
        landingError = $('#landing-error'),
        landingSuccessText = $('#landing-success p'),
        landingErrorText = $('#landing-error p'),

        // form control
        exitLoginButton = function () {
          loginButton.removeClass('cs-button-alert');
          resetLoginStyles();
        },
        resetLoginStyles = function () {
          loginEmailLabel.css('color', '#ccc');
          loginPasswordLabel.css('color', '#ccc');
        },
        checkInput = function () {
          if (this.value.trim() != '') {
            $(this).removeClass('cs-input-alert');
          }
        };

    // preliminary validation
    loginButton.bind('mouseenter', function () {
      var email = loginEmail.val().trim(),
          password = loginPassword.val().trim();
      if (email != '' && password != '') {
        resetLoginStyles();
      } else {
        loginButton.addClass('cs-button-alert');
        if (email == '')
          loginEmailLabel.css('color', 'red');
        if (password == '')
          loginPasswordLabel.css('color', 'red');
      }
    }).bind('mouseleave', exitLoginButton);

    // mid-typing validation
    loginEmail.bind('keyup', checkInput);
    loginPassword.bind('keyup', checkInput);

    // try to login
    loginButton.bind('click', function (e) {
      e.preventDefault();
      landingError.hide();
      var data = loginForm.serializeObject();
      $.post('/sessions', data, function (serv) {
      // DNode('/sessions', data, function (serv) {
        if (serv.status == 'success') {
          window.location = '/';
        } else if (serv.status == 'fail') {
          landingErrorText.html(serv.data.message);
          landingError.fadeIn('fast');
          switch (serv.data.code) {
            case 'MISSING_FIELD':
              var missing = serv.data.missing;
              for (var i=0; i < missing.length; i++) {
                $('input[name="user[' + missing[i] + ']"]').addClass('cs-input-alert');
              }
              break;
            case 'BAD_AUTH':
              loginPassword.val('').focus();
              break;
            case 'NOT_CONFIRMED':
              break;
          }
        } else if (serv.status == 'error') {
          landingErrorText.html(serv.message);
          landingError.fadeIn('fast');
        }
      }, 'json');
    });

    // move cursor to login field
    loginEmail.focus();

    // useless map stuff
    var wrap = $('#landing-map'),
        chicago = new google.maps.LatLng(39.6,-94.35),
        map,
        mapOptions = {
          zoom: 4,
          center: chicago,
          disableDefaultUI: true,
          mapTypeControlOptions: {
            mapTypeIds: [ google.maps.MapTypeId.ROADMAP, 'greyscale' ]
          }
        },
        mapType = new google.maps.StyledMapType(style.mapStylez, style.mapStyledOptions);

    // make new map
    map = new google.maps.Map(wrap[0], mapOptions);
    map.mapTypes.set('grayscale', mapType);
    map.setMapTypeId('grayscale');

    // ready
    google.maps.event.addListener(map, 'tilesloaded', function () {
      google.maps.event.trigger(map, 'resize');
      wrap.removeClass('map-tmp');
    });

  });
});

