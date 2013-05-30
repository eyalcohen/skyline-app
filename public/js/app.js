/*
 * Skyline application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router'
], function ($, _, Backbone, Router) {

  var App = function () {
    this.socket = io.connect('http://localhost:8080');
    // this.socket.on('remote', function (data) {
    //   console.log(data);
    //   // socket.emit('my other event', { my: 'data' });
    // });

  }

  App.prototype.authorize = function () {

    this.socket.emit('authorize', function (user) {
      console.log(user)
      // if (err) {
      //   console.warn('Server connected. User NOT authorized!');
      //   if ('Error: User and Session do NOT match!' === err) {
      //     App.publish('NotAuthenticated', [{
      //       report: 'Oops! Something bad happened so you were Signed Out. Please Sign In again.',
      //       type: 'error',
      //     }]);
      //   } else if ('Session has no User.') {
      //     var opts = {
      //       first: !reconnect,
      //       report: '',
      //       type: 'message',
      //     };
      //     if(App.util.HashSearch.keyExists('oops')) {
      //       opts.report = 'Incorrect email or password.';
      //       opts.type = 'error';
      //       App.router.navigate('', { replace: true });
      //     }
      //     App.publish('NotAuthenticated', [opts]);
      //   } else console.warn(err);
      //   App.loading.stop();
      // } else {
      //   console.warn('Server connected. User authorized!');
      //   App.user = user;
      //   App.publish(reconnect ? 'DNodeReconnectUserAuthorized'
      //               : 'UserWasAuthenticated');
      // }
    });
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App();
      app.authorize();
      app.router = new Router(app);
      Backbone.history.start({pushState: true});
    }
    
  };
});
