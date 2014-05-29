/*
 * Dataset configuration view
 * TODO: Add spinner for long loading SVGs and REST interface
 *       Add public/private button
 *       Click the SVG to load the channel
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'models/dataset',
  'text!../../templates/dataset.config.html',
  'text!../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Spin, Dataset, template, confirm) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.id = options.id;
      this.user = options.user;

      this.on('rendered', this.setup, this);
      this.channelNames = [];

      this.animate = true;

    },

    render: function () {

      // Set page title
      this.app.title('Skyline | ' + this.app.profile.user.displayName + ' - Settings');

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .demolish': 'demolish',
    },

    setup: function () {

      rest.get('/api/datasets/' + this.options.id, _.bind(function (err, dataset) {

        if (!err) {
          this.model = new Dataset(dataset);

          this.template = _.template(template);
          this.$el.html(this.template.call(this, {util: util}));
          this.drawSvg();
        }

        $('.title-left').text(this.model.get('title'));

        // Save field contents on blur.
        this.$('textarea, input[type="text"], input[type="checkbox"], input[type="radio"]')
            .change(_.bind(this.save, this))
            .keyup(function (e) {
          var field = $(e.target);
          var name = field.attr('name');
          var capName = name.charAt(0).toUpperCase() + name.slice(1);
          var label = $('label[for="dataset' + capName + '"]');
          var saved = $('.settings-saved', label.parent().parent());

          if (field.val().trim() !== field.data('saved'))
            saved.hide();

          return false;
        });

        // Handle error display.
        this.$('input[type="text"]').blur(function (e) {
          var el = $(e.target);
          if (el.hasClass('input-error'))
            el.removeClass('input-error');
        });

        $('.settings-svg').mouseenter(_.bind(function() { this.animate = false; }, this ));
        $('.settings-svg').mouseleave(_.bind(function() { this.animate = true; }, this ));

      }, this));

      return this;
    },

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

    // Save the field.
    save: function (e) {
      var field = $(e.target);
      var name = field.attr('name');
      var capName = name.charAt(0).toUpperCase() + name.slice(1);
      var label = $('label[for="dataset' + capName + '"]');
      var saved = $('.settings-saved', label.parent().parent());
      var errorMsg = $('.settings-error', label.parent().parent()).hide();
      var val = util.sanitize(field.val());

      // Handle checkbox.
      if (field.attr('type') === 'checkbox')
        val = field.is(':checked');

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      payload[name] = val;

      // Now do the save.
      rest.put('/api/datasets/' + this.id, payload,
          _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          errorMsg.text(err.message).show();

          return false;
        }

        // Save the saved state and show indicator.
        field.data('saved', val);
        saved.show();

      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this dataset?', 
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('#m_cancel').click(function (e) {
        $.fancybox.close();
      });
      $('#m_yes').click(_.bind(function (e) {

        // Delete the user.
        rest.delete('/api/datasets/' + this.id, 
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // Close the modal.
          $.fancybox.close();

          // Route to home.
          this.app.router.navigate('/', {trigger: true});

        }, this));
      }, this));

      return false;
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    drawSvg: function() {
      var channels = this.model.get('channels');
      var selector = $('.settings-svg');
      var width = selector.width();
      var height = selector.height();

      var sampleSet = [];
      var channelIter = 0;

      // Called after data collection
      var finalizeSvg = _.after(channels.length, _.bind(function() {

        // Create initial SVG
        var svg = d3.select(selector.get(0))
            .append('svg:svg')
            .attr('width', width)
            .attr('height', height)
            .append('svg:g')
            .append('svg:path')

        d3.select(selector.get(0)).select('g')
            .append('svg:text')
            .attr('y', height-10)
            .attr('x', 10)
            .attr('fill', '#666')


        setInterval(_.bind(function () {
          if (!this.animate) return;
          var t_0 = _.min(_.pluck(channels, 'beg'));
          var t_max = _.max(_.pluck(channels, 'end'));
          var t_diff = t_max - t_0;

          var v_min = _.max(_.pluck(sampleSet[channelIter], 'val'));
          var v_max = _.min(_.pluck(sampleSet[channelIter], 'val'));
          var v_diff = v_max - v_min;

          var path = d3.svg.area()
              .x(function (s, i) {
                if (t_diff === 0) {
                  return i === 0 ? 0: width;
                } else {
                  return ((s.beg - t_0) / t_diff * width);
                }
              })
              .y0(function () {
                return height;
              })
              .y1(function (s) {
                return v_diff === 0 || s.val === null ? v_max: height - ((s.val - v_min) / v_diff * height);
              })
              .interpolate('linear');

          d3.select(selector.get(0)).select('path')
              .transition()
              .attr('d', path(sampleSet[channelIter]))
              .attr('class', 'area')
              .attr('fill', this.app.colors[channelIter % this.app.colors.length])
              .attr('opacity', .6);

          d3.select(selector.get(0)).select('text')
            .transition()
            .text(channels[channelIter].humanName);

          channelIter = (channelIter + 1) % channels.length;
        }, this), 3000);
      }, this));

      // Collect sample data for each channel
      _.each(channels, function(c, idx) {

        var opts = {
          beginTime: c.beg,
          endTime: c.end,
          minDuration: (c.end - c.beg) / 100
        };

        this.app.rpc.do('fetchSamples', Number(this.id), c.channelName,
            opts, _.bind(function (err, sampleObj) {

          if (err) {
            console.log(err);
            return;
          }

          if (!sampleObj.samples[0]) return;

          var prevEnd = null;
          var data = [];
          _.each(sampleObj.samples, function (s) {
            // Add points to deal with non-contiguous samples
            if (prevEnd != s.beg) {
              data.push({beg: prevEnd, end: prevEnd, val:null});
              data.push({beg: s.beg, end: s.beg, val:null});
            }
            data.push(s);
            prevEnd = s.end;
          });

          if (data.length === 1) {
            data.push(_.clone(data[0]));
          }

          sampleSet.push(data);

          finalizeSvg();

        }));
      }, this);
    },



  });
});
