/*!
 * Copyright 2011 Mission Motors
 */

define(['jquery', 'libs/jquery.simplemodal-1.4.1'],
    function ($) {
  return Backbone.View.extend({

    initialize: function (args) {
      _.bindAll(this, 'render', 'destroy', 'open', 'close');
      App.subscribe('NotAuthenticated', this.destroy);
      this.firstOpen = true;
      this.saved = true;
      this.aceEditor;
      return this;
    },

    render: function () {
      var self = this;
      self.el = App.engine('editor.dialog.jade').appendTo('body').modal({
        overlayId: 'osx-overlay-editor',
        containerId: 'osx-container-editor',
        closeHTML: null,
        minHeight: 80,
        minWidth: 700,
        opacity: 65,
        position: ['0',],
        overlayClose: true,
        keep: true,
        onOpen: function (d) {
          var this_ = this;
          if (self.firstOpen) {
            self.firstOpen = false;
            self.modal = this_;
            this_.container = d.container[0];
            return;
          }
          d.overlay.fadeIn('fast', function () {
            $('#osx-modal-content-editor', this_.container).show();
            var title = $('#osx-modal-title-editor', this_.container);
            title.show();
            d.container.slideDown('fast', function () {
              setTimeout(function () {
                var h = $('#osx-modal-data-editor', this_.container).height() +
                    title.height() + 20;
                d.container.animate({ height: h }, 200, function () {
                  $('#osx-container-editor').height(572);
                  $('div.close', this_.container).show();
                  $('#osx-modal-data-editor', this_.container).fadeIn('fast');
                });
              }, 300);
            });
          });
        },
        onClose: function (d) {
          var this_ = this;
          self.hideMessage();
          self.ready = false;
          d.container.animate({ top: -600 }, 300, function () {
            $('#osx-container-editor').hide().css({ height: 80, top: 0 });
            $('#osx-modal-content-editor', this_.container).hide();
            $('#osx-modal-title-editor', this_.container).hide();
            $('div.close', this_.container).hide();
            $('#osx-modal-data-editor', this_.container).hide();
            d.overlay.fadeOut('fast');
          });
        },
      });
      $('#save-editor').click(function (e) {
        self.onSave(self.aceEditor.getSession().getValue(), function (err, data) {
          if (err) self.showMessage(err, 'gray');
          else {
            var txt = self.aceEditor.getSession().setValue(data);
            self.saved = true;
            self.showMessage('Saved!', 'green');
          }
        });
      });
      return self;
    },

    destroy: function () {
      App.unsubscribe('NotAuthenticated', this.destroy);
      this.remove();
      return this;
    },

    open: function (title, content, onSave) {
      var self = this;
      $('#osx-modal-title-editor').html(title);
      self.onSave = onSave;
      if (!self.aceEditor)
        self.build(openInternal);
      else openInternal();
      function openInternal() {
        self.modal.open();
        self.aceEditor.getSession().setValue(content);
        self.ready = true;
      }
      return self;
    },

    close: function () {
      this.modal.close();
      return this;
    },

    showMessage: function (text, color) {
      $('.editor-message').text(text).css({color:color}).show();
    },

    hideMessage: function () {
      $('.editor-message').hide();
    },

    build: function (cb) {
      var self = this;
      var iframe = document.editor || window.editor;
      var doc = iframe.document;
      var win = iframe.window;
      var pre = $('<pre id="editor">');
      var acer = setInterval(function () {
        if (win.ace && doc.body) {
          clearInterval(acer);
          win.stop();
          var css = doc.createElement('link');
          css.href = '/stylesheets/editor.css';
          css.rel = 'stylesheet';
          css.type = 'text/css';
          doc.head.appendChild(css);
          pre.appendTo($(doc.body));
          self.aceEditor = win.ace.edit('editor');
          self.aceEditor.setTheme('ace/theme/solarized_dark');
          var XMLMode = win.require('ace/mode/xml').Mode;
          self.aceEditor.getSession().setMode(new XMLMode());
          self.aceEditor.getSession().setTabSize(4);
          self.aceEditor.getSession().setUseSoftTabs(true);
          self.aceEditor.getSession().setUseWrapMode(true);
          self.aceEditor.setShowPrintMargin(false);
          self.aceEditor.getSession().on('change', function () {
            if (self.saved && self.ready) {
              self.saved = false;
              self.showMessage('Not saved.', 'gray');
            }
          });
          cb();
        }
      }, 10);
      doc.write('<scr' + 'ipt type="text/javascript" ' +
                'src="/javascripts/libs/ace/ace.js"><\/scr' + 'ipt>');
      doc.write('<scr' + 'ipt type="text/javascript" ' +
                'src="/javascripts/libs/ace/theme-solarized_dark.js"><\/scr' + 'ipt>');
      doc.write('<scr' + 'ipt type="text/javascript" ' +
                'src="/javascripts/libs/ace/mode-xml.js"><\/scr' + 'ipt>');
      doc.write('<bo' + 'dy><\/bo' + 'dy>');
    },

  });
});

