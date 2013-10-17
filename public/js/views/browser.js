/*
 * Data browser modal view
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
  'text!../../templates/browser.html',
  'views/lists/profile.datasets'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, template, Datasets) {

  return Backbone.View.extend({
    
    // The DOM target element for this page.
    className: 'browser',
    working: false,
    
    // Module entry point.
    initialize: function (app, options) {
      
      // Save app reference.
      this.app = app;
      this.options = options;

      if (this.options && this.options.meta) {
        this.options.meta.dataset_cnt = this.options.datasets.length;
        this.options.meta.channel_cnt = 0;
        _.each(this.options.datasets, _.bind(function (d) {
          this.options.meta.channel_cnt += d.channels.length;
        }, this));
        delete this.options.meta.width;
      }

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

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

      // Init the load indicator.
      this.spin = new Spin(this.$('.browser-spin'), {
        lines: 17,
        length: 12,
        width: 4,
        radius: 18,
        corners: 1,
        rotate: 0,
        direction: 1,
        color: '#808080',
        speed: 1.5,
        trail: 60,
        shadow: false,
        hwaccel: false,
        className: 'spinner',
        zIndex: 2e9,
        top: 'auto',
        left: 'auto'
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .browser-add-form input[type="submit"]': 'add',
      'change input[name="data_file"]': 'update',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.addNewfileForm = $('.browser-add-form');
      this.newFileInput = $('input[name="dummy_data_file"]', this.addNewfileForm);
      this.newFileSubmit = $('input[type="submit"]', this.addNewfileForm);

      // Handle error display.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Render datasets.
      this.datasets = new Datasets(this.app, {
        datasets: {
          more: true,
          items: [],
          query: {author_id: this.app.profile.user.id}
        },
        modal: true,
        parentView: this,
        reverse: true
      });

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]:visible'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
        return empty;
      });
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

    update: function (e) {
      var files = e.target.files;
      var name;
      if (files.length === 0) {
        name = '';
        this.newFileSubmit.attr({disabled: "disabled"});
      } else {
        name = files[0].name;
        this.newFileSubmit.attr({disabled: false});
      }
      this.newFileInput.val(name);
    },

    add: function (e) {
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Get the file.
      var files = this.newFileInput.get(0).files;
      if (files.length === 0) return false;
      var file = files[0];

      // Use a FileReader to read the file as a base64 string.
      var reader = new FileReader();
      reader.onload = _.bind(function () {

        // Check file type for any supported...
        // The MIME type could be text/plain or application/vnd.ms-excel
        // or a bunch of other options.  For now, switch to checking the
        // extension and consider improved validation down the road, particularly
        // as we add support for new file types
        var ext = file.name.split('.').pop();
        if (ext !== 'csv' && ext !== 'xls')
          return false;

        // Construct the payload to send.
        var payload = {
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
            ext: ext
          },
          base64: reader.result.replace(/^[^,]*,/,''),
        };

        // Mock dataset.
        var data = {
          id: -1,
          author: this.app.profile.user,
          updated: new Date().toISOString(),
          title: _.str.strLeft(file.name, '.'),
          file: {
            size: file.size,
            type: file.type,
          },
          meta: {
            beg: 0,
            end: 0,
            channel_cnt: 0,
          }
        };

        // Optimistically add dataset to page.
        this.collection.unshift(data);

        // Create the dataset.
        this.app.rpc.do('insertSamples', payload,
            _.bind(function (err, res) {

          if (err)
            return console.error(err);

          if (res.created === false) {

            // Remove row.
            this.working = false;
            return this._remove({id: -1});
          }

          // Update the dataset id.
          var dataset = this.collection.get(-1);
          dataset.set('client_id', res.client_id);
          dataset.set('meta', res.meta);
          dataset.set('id', res.id);
          this.$('#-1').attr('id', res.id);

          // Ready for more.
          this.working = false;

        }, this));

      }, this);
      reader.readAsDataURL(file);

      return false;
    },

    // save: function (e) {
    //   e.preventDefault();

    //   // Grab the form data.
    //   var payload = this.saveForm.serializeObject();

    //   // Client-side form check.
    //   var errorMsg = $('.save-error', this.saveForm);
    //   var check = util.ensure(payload, ['name']);

    //   // Add alerts.
    //   _.each(check.missing, _.bind(function (m, i) {
    //     var field = $('input[name="' + m + '"]', this.saveForm);
    //     field.val('').addClass('input-error');
    //     if (i === 0) field.focus();
    //   }, this));

    //   // Show messages.
    //   if (!check.valid) {

    //     // Set the error display.
    //     var msg = 'All fields are required.';
    //     errorMsg.text(msg);

    //     return;
    //   }

    //   // All good, show spinner.
    //   this.$('.modal-inner > div').hide();
    //   this.spin.start();

    //   // Add other data.
    //   _.extend(payload, this.options);

    //   // Do the API request.
    //   rest.post('/api/views', payload, _.bind(function (err, data) {
    //     if (err) {

    //       // Stop spinner.
    //       this.spin.stop();
    //       this.$('.modal-inner > div').show();

    //       // Set the error display.
    //       errorMsg.text(err);

    //       // Clear fields.
    //       $('input[type="text"]', this.saveForm).val('')
    //           .addClass('input-error');
    //       this.focus();
          
    //       return;
    //     }

    //     // Route to profile.
    //     var route = [this.app.profile.user.username, 'views', data.slug].join('/');
    //     this.app.router.navigate('/' + route, {trigger: true});

    //     // Stop spinner.
    //     this.spin.stop();

    //     // Close the modal.
    //     $.fancybox.close();
        
    //   }, this));

    //   return false;
    // },

  });
});
