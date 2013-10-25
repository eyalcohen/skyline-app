/*
 * Profile Dataset Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/profile.dataset.html',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, Row, template, confirm) {
  return Row.extend({

    tagName: 'tr',

    attributes: function () {
      return _.defaults({class: 'profile-dataset'},
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

      if (!this.parentView.modal) {

        // Set app state.
        var state = {user_id: this.app.profile.user.id};
        state.datasets = {};
        state.datasets[this.model.get('id')] = {index: 0};
        store.set('state', state);

        // Route to a new chart.
        this.app.router.navigate('/chart', {trigger: true});
      } else {

        // Add this dataset to the existing chart.
        mps.publish('chart/datasets/new', [this.model.get('id')]);  

        // Close the modal.
        $.fancybox.close();
      }
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'I want to delete this data source.',
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
        rest.delete('/api/datasets/' + this.model.id, {},
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
