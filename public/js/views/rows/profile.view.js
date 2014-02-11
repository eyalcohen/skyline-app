/*
 * Profile View Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/profile.view.html',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, Row, template, confirm) {
  return Row.extend({

    tagName: 'tr',

    attributes: function () {
      var klass = 'profile-view';
      if (this.model.get('public') === false)
        klass += ' profile-view-locked';
      return _.defaults({class: klass},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {
      return Row.prototype.setup.call(this);
    },

    events: {
      'click': 'navigate',
      'click .profile-item-delete': 'delete',
    },

    navigate: function (e) {
      e.preventDefault();
      if ($(e.target).hasClass('profile-item-delete')
          || $(e.target).hasClass('icon-cancel')) return;

      if ($(e.target).hasClass('navigate')) {
        var path = $(e.target).closest('a').attr('href');
        if (path)
          this.app.router.navigate(path, {trigger: true});
        return;
      }

      // Route to a new chart.
      var path = [this.model.get('author').username, 'views',
          this.model.get('slug')].join('/');
      this.app.router.navigate('/' + path, {trigger: true});
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'I want to delete this data mashup.',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('#m_cancel').click(function (e) {
        $.fancybox.close();
      }).focus();
      $('#m_yes').click(_.bind(function (e) {

        // Delete.
        rest.delete('/api/views/' + this.model.id, {},
            _.bind(function (err, data) {
          if (err) return console.log(err);

          // Close the modal.
          $.fancybox.close();

        }, this));

        // Remove from UI.
        this.parentView._remove({id: this.model.id});

      }, this));

      return false;
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
