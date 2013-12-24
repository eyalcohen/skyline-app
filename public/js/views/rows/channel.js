/*
 * Channel Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/channel.html',
  'text!../../../templates/linestyle.html',
  'Spin'
], function ($, _, mps, Row, template, linestyleTemplate, Spin) {
  return Row.extend({

    active: false,

    attributes: function () {
      return _.defaults({class: 'channel hide'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/added', _.bind(this.added, this)),
        mps.subscribe('channel/removed', _.bind(this.removed, this)),
      ];

      Row.prototype.initialize.call(this, options);
    },

    setup: function () {

      // Save refs.
      this.button = this.$('a.channel-button');
      this.name = this.$('.channel-name', this.button);
      this.txt = this.$('.channel-name span');

      console.log(this.model);

      // Bind click event.
      // this.button.click(_.bind(this.toggle, this));

      // Check if active in state.
      var state = store.get('state');
      _.each(state.datasets, _.bind(function (d) {
        if (d.channels && d.channels[this.model.id]) {
          var c = d.channels[this.model.id];
          var v = this.model.get('val');
          v.colorNum = c.colorNum;
          v.yaxisNum = c.yaxisNum;
          this.model.set('val', v);
          mps.publish('channel/add', [this.model.get('did'), v]);
          this.active = true;
          this.$el.addClass('active').show();
        }
      }, this));

      // Initial fit.
      this.fit(this.$el.width());

      return Row.prototype.setup.call(this);
    },

    events: {
      // TODO: Make this mouse in-out
      'click .icon-chart-line' : function(e) {
        if (!($('.linestyle-modal').length))
          this.$el.append(_.template(linestyleTemplate));
        else {
          $('.linestyle-modal').remove();
        }
      },
      /*
      'mouseenter .linestyle-modal' : function(e) { this.inLineStyleModal = true; }, 
      'mouseleave .linestyle-modal' : function(e) { 
        if (this.inLineStyleModal) {
          $('.linestyle-modal').remove();
          this.inLineStyleModal = false;
        }
      }
      */
    },

    fit: function (w) {
      this.$el.width(w);
      this.fitName(w - 20);
    },

    fitName: function (w) {
      var txt = this.model.name();
      this.txt.text(txt);
      var tw = this.name.outerWidth();
      if (tw && tw >= w) {
        var len = txt.length;
        var i = 1;
        while (tw >= w) {
          this.txt.text(txt.substr(0, len - i) + '...');
          tw = this.name.outerWidth();
          ++i;
        }
      }
    },

    toggle: function (e) {
      if (e) e.preventDefault();
      if (this.$el.hasClass('active')) {
        this.$el.removeClass('active');
        mps.publish('channel/remove', [this.model.get('did'),
          this.model.get('val')]);
        this.active = false;
      } else {
        this.$el.addClass('active');
        mps.publish('channel/add', [this.model.get('did'),
          this.model.get('val')]);
        this.active = true;
      }
      return false;
    },

    expand: function () {
      if (!this.$el.hasClass('active')) {
        this.$el.slideDown('fast');
        this.$el.css({opacity: 1});
      }
    },

    collapse: function () {
      if (!this.$el.hasClass('active')) {
        this.$el.slideUp('fast');
        this.$el.css({opacity: 0});
      }
    },

    added: function (did, channel) {
      if (this.model.id !== channel.channelName) return;

      // Set colors.
      var color = this.app.colors[channel.colorNum];
      this.$el.css({
        backgroundColor: color,
        borderColor: color
      });
      // this.$el.addClass('active');
    },

    removed: function (did, channel) {
      if (this.model.id !== channel.channelName) return;

      // Set colors.
      this.$el.css({
        backgroundColor: 'transparent',
        borderColor: '#d0d0d0'
      });
      // this.$el.removeClass('active');
    },

    destroy: function () {
      Row.prototype.destroy.call(this);
      
      // Remove channel from graph.
      mps.publish('channel/remove', [this.model.get('did'),
          this.model.get('val')]);
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    linestyleModal: function () {
      if (!$('.linestyle-modal').exists())
        this.$el.append(_.template(linestyleTemplate));
      //console.log('mouseenter');
    },

  });
});
