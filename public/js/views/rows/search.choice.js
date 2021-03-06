/*
 * Choice Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/search.choice.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'a',

    attributes: function () {
      var klass = 'choice';
      if (this.model.get('_type') === 'divider') {
        klass += 'search-divider';
      }
      if (this.model.get('public') === false)
        klass += ' locked';
      return _.defaults({class: klass},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {

      // Add extra data.
      this.$el.attr({href: this.model.href()});
      this.$el.attr({'data-term': this.model.term()});

      return Row.prototype.render.call(this, single, prepend);
    },

    events: {
      'click': 'choose',
    },

    choose: function (e) {
      if (e) e.preventDefault();

      // nothing to be done for the divider
      if (this.model.get('_type') === 'divider') {
        return;
      }


      // Show selection.
      this.parentView.choose(this);

      // Go to page.
      if (!this.parentView.options.route) return;
      if (this.app.router.pageType === 'chart') {
        switch (this.model.get('_type')) {
          case 'datasets':
            mps.publish('dataset/select', [this.model.get('id')]);
            break;
          case 'channels':
            var cn = this.model.get('channelName');
            var did = Number(this.model.get('parent').id);
            mps.publish('channel/request', [did, cn, function (channel) {
              if (channel) {
                mps.publish('channel/add', [did, channel.toJSON()]);
              } else {
                mps.publish('dataset/requestOpenChannel', [cn]);
                mps.publish('dataset/select', [did]);
              }
            }]);
            break;
          default:
            this.app.router.navigate(this.$el.attr('href'), {trigger: true});
            break;
        }
      } else {
        this.app.router.navigate(this.$el.attr('href'), {trigger: true});
      }
    },

  });
});
