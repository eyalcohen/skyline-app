/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem', 'libs/jquery.simplemodal-1.4.1.min'
    //'libs/ace/ace'//, 'libs/ace/theme-monokai', 'libs/ace/mode-xml'
    ], function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'mouseenter tr': 'showPanel',
      'mouseleave tr': 'hidePanel',
      'click .open-vehicle': 'open',
      'click .config-link': 'configure',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        loading: false,
        rows: this.collection.models,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      this.el = App.engine('vehicles.dash.jade', opts)
          .appendTo(this.options.parent);
      this._super('render');
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.setTime, 5000);
      this.setTime();
      return this;
    },

    showPanel: function (e) {
      var tr = $(e.target).closest('tr');
      $('.edit-panel', tr).css({ visibility: 'visible' });
    },

    hidePanel: function (e) {
      var tr = $(e.target).closest('tr');
      $('.edit-panel', tr).css({ visibility: 'hidden' });
    },

    open: function (e) {
      var parentRow = $(e.target).closest('tr');
      var lastSeen = parseInt(
          $('[data-time]', parentRow).attr('data-time'));
      var lastCycle = JSON.parse(
          $('[data-cycle]', parentRow).attr('data-cycle'));
      var items = parentRow.attr('id').split('_');
      var id = parseInt(items[items.length - 1]);
      var title = $(e.target).closest('tr').attr('data-title');
      App.publish('VehicleRequested', [id, title, lastCycle]);
      return this;
    },

    configure: function (e) {
      App.api.fetchVehicleConfig('sdvdsv', function (err, xml) {
        if (err) throw err;
        else {
          App.engine('configure.dialog.jade', {
            vehicleId: 'fsvsdfvds',
          }).appendTo('body').modal({
            overlayId: 'osx-overlay',
            containerId: 'osx-container',
            closeHTML: null,
            minHeight: 80,
            minWidth: 700,
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
                    var h = $('#osx-modal-data', self.container).height() +
                        title.height() + 20;
                    d.container.animate({ height: h }, 200, function () {
                      $('#osx-container').height(572);
                      createEditor(xml, function () {
                        $('div.close', self.container).show();
                        $('#osx-modal-data', self.container).fadeIn('fast');
                      });
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
      });

      function createEditor(initial, cb) {
        var iframe = document.editor || window.editor;
        var doc = iframe.document;
        var win = iframe.window;
        var pre = $('<pre id="editor">').text(initial);
        var acer = setInterval(function () {
          if (win.ace && doc.body) {
            clearInterval(acer);
            var css = doc.createElement('link');
            css.href = '/stylesheets/config.css';
            css.rel = 'stylesheet';
            css.type = 'text/css';
            doc.head.appendChild(css);
            pre.appendTo($(doc.body));
            var aceEditor = win.ace.edit('editor');
            aceEditor.setTheme('ace/theme/solarized_dark');
            var XMLMode = win.require('ace/mode/xml').Mode;
            aceEditor.getSession().setMode(new XMLMode());
            aceEditor.getSession().setTabSize(4);
            aceEditor.getSession().setUseSoftTabs(true);
            aceEditor.getSession().setUseWrapMode(true);
            aceEditor.setShowPrintMargin(false);
            setTimeout(cb, 500);
          }
        }, 10);
        doc.write('<scr' + 'ipt type="text/javascript" ' +
                  'src="/javascripts/libs/ace/ace.js"><\/scr' + 'ipt>');
        doc.write('<scr' + 'ipt type="text/javascript" ' +
                  'src="/javascripts/libs/ace/theme-solarized_dark.js"><\/scr' + 'ipt>');
        doc.write('<scr' + 'ipt type="text/javascript" ' +
                  'src="/javascripts/libs/ace/mode-xml.js"><\/scr' + 'ipt>');
        doc.write('<bo' + 'dy><\/bo' + 'dy>');
      }

    },
  });
});

