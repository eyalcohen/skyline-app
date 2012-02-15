/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery', 'libs/jquery.simplemodal-1.4.1'], function ($) {
  return Backbone.View.extend({
    initialize: function (args) {
      _.bindAll(this, 'render', 'signout', 'destroy', 'permalink');
      App.subscribe('UserWasAuthenticated', this.render);
      App.subscribe('NotAuthenticated', this.destroy);
      return this;
    },

    events: {
      'click #logout': 'signout',
      'click #permalink': 'permalink',
    },

    render: function () {
      this.el = App.engine('logout.jade', {
        email: App.user.primaryEmail,
        name: App.user.displayName
      }).appendTo(App.regions.menu);
      this.delegateEvents();
      return this;
    },

    destroy: function () {
      this.remove();
      this.el = false;
      return this;
    },

    signout: function (e) {
      App.user = null;
      $.get('/logout');
      App.publish('NotAuthenticated', [{
        first: true,
        report: 'Thank you. Come again.',
        type: 'message',
      }]);
      return this;
    },

    permalink: function (e) {
      var self = this;
      var state = App.stateMonitor.getState();
      if (state === '')
        openDialog('http://' + window.location.host);
      else
        App.api.saveLink(state, function (err, key) {
          openDialog('http://' + window.location.host + '/s/' + key);
        });
      function openDialog(link) {
        App.engine('permalink.dialog.jade',
            { link: link }).appendTo('body').modal({
          overlayId: 'osx-overlay',
          containerId: 'osx-container',
          closeHTML: null,
          minHeight: 80,
          opacity: 65,
          position: ['0',],
          overlayClose: true,
          onOpen: function (d) {
            var self = this;
            self.container = d.container[0];
            d.overlay.fadeIn('fast', function () {
              $('#osx-modal-content', self.container).show();
              var title = $('#osx-modal-title', self.container);
              title.show();
              d.container.slideDown('fast', function () {
                setTimeout(function () {
                  var h = $('#osx-modal-data', self.container).height()+
                      title.height() + 20;
                  d.container.animate({ height: h }, 200, function () {
                    $('div.close', self.container).show();
                    $('#osx-modal-data', self.container).show();
                    $('.permalink-txt').select();
                  });
                }, 300);
              });
            });
          },
          onClose: function (d) {
            var self = this;
            d.container.animate({ top:'-' + (d.container.height() + 20) }, 300,
                function () {
              self.close();
              $('#osx-modal-content').remove();
            });
          },
        });
      }
    },

  });
});

