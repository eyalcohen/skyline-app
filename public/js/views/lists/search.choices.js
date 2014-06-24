/*
 * Choices List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'Spin',
  'collections/search.choices',
  'views/rows/search.choice'
], function ($, _, List, mps, rest, util, Spin, Collection, Row) {
  return List.extend({

    active: false,
    str: null,
    selecting: {el: null, i: -1},

    initialize: function (app, options) {
      this.app = app;
      this.collection = new Collection();
      this.Row = Row;
      this.options = options;
      this.setElement(options.el);

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // usefulf or organizing search results
      this.datasetList = [];

      // Client-wide subscriptions
      this.subscriptions = [
        mps.subscribe('channel/added', _.bind(function (ds, cn) {
          this.datasetList.push(ds);
        }, this)),
        mps.subscribe('channel/removed', _.bind(function (ds, cn) {
          this.datasetList.splice(this.datasetList.indexOf(ds), 1);
        }, this))
      ];

      // Reset the collection.
      this.collection.reset([]);
    },

    // Mouse events.
    events: {
      'click .search-choice-clear': 'clearChoice',
      'click .search-filter-justme': 'checkJustMe',
      'click .search-filter-allusers': 'checkAllUsers'
    },

    // Misc. setup
    setup: function () {

      // Save refs.
      this.input = this.$('input[type="search"]');
      this.results = this.$('.search-display');
      this.choiceWrap = this.$('.search-choice');
      this.choiceContent = this.$('.search-choice-content');
      this.justme = this.$('.search-filter-justme');
      this.allusers = this.$('.search-filter-allusers');
      this.spin = new Spin(this.$('.search-spin'), {
        color: '#4d4d4d',
        lines: 11,
        length: 2,
        width: 1,
        radius: 3,
      });

      var _search = _.bind(this.search, this);

      // Handle searching.
      this.input.bind('focus', _.bind(this.searchFocus, this));
      this.input.bind('keyup', _.bind(_.debounce(_search, 250), this));
      this.input.bind('keydown', _.bind(this.searchBlur, this));
      $(document).on('mouseup', _.bind(this.searchBlur, this));

      this.defaults();
      if (this.options.default) {
        _.delay(_.bind(function () {
          this.input.focus();
        }, this), 100);
      }

      return List.prototype.setup.call(this);
    },

    highlight: function () {
      this.selecting.el = this.$('a.choice').eq(this.selecting.i);
      this.$('a.choice').removeClass('hover');
      this.selecting.el.addClass('hover');
      var h = this.selecting.el.outerHeight() - 1;
      var be = h + this.selecting.el.offset().top - this.results.offset().top - 1;
      var H = this.results.height();
      var s = this.results.scrollTop();
      if (be > H) {
        this.results.scrollTop(this.results.scrollTop() + h);
      } else if (be < h) {
        this.results.scrollTop(this.results.scrollTop() - h);
      }
    },

    resetHighlight: function () {
      this.selecting = {el: null, i: -1};
      this.results.scrollTop(0);
    },

    searchFocus: function (e) {
      this.input.attr({placeholder: this.options.placeholder});
      this.input.parent().addClass('active');
      this.active = true;
      this.app.searchIsActive = true;
      if (this.searchVal() && this.collection.length > 0) {
        this.showResults();
      }
    },

    searchBlur: function (e) {
      if (!this.active) return;

      // Ensure we are inside input.
      if ($(e.target).hasClass(this.input.attr('class'))) {

        // Enter
        if (e.keyCode === 13 && e.which === 13) {
          if (this.selecting.el) {
            this.views[this.selecting.el.index() - 1].choose();
            if (!this.options.choose)
              this.input.select();
          }
          return false;
        }

        // If tab, then proceed with blur.
        else if (e.keyCode !== 9 && e.which !== 9) {

          // Up
          if (e.keyCode === 38 && e.which === 38) {
            if (this.selecting.i > 0) {
              this.selecting.i--;
              this.highlight();
            }
            return false;
          }

          // Down
          else if (e.keyCode === 40 && e.which === 40) {
            if (this.selecting.i < this.collection.length - 1) {
              this.selecting.i++;
              this.highlight();
            }
            return false;
          }

          return;
        }
      }

      // Blur.
      if (!this.searchVal()) {
        this.input.attr({placeholder: 'Search...'});
      }
      this.input.parent().removeClass('active');
      this.hideResults();
      this.resetHighlight();
      this.active = false;
      this.app.searchIsActive = false;
    },

    searchVal: function () {
      var str = util.sanitize(this.input.val());
      return str === '' ? null: str;
    },

    search: function (e) {

      // Clean search string.
      var str = this.searchVal();

      // Handle interaction.
      if (str && str === this.str) return;
      this.str = str;
      if (!str) {
        if (this.options.default) {
          if (this.collection.length === 0) {
            this.defaults();
          }
        } else {
          this._clear();
          this.resetHighlight();
          this.hideResults();
        }
        return;
      }

      // Setup search types.
      var items = {};
      var done = _.after(this.options.types.length, _.bind(this.done, this));

      // Perform searches.
      this.spin.start();
      _.each(this.options.types, _.bind(function (t) {
        rest.post('/api/' + t + '/search/' + str, {},
            _.bind(function (err, data) {
          this.spin.stop();
          if (err) {
            return console.log(err);
          }

          if (data.items.length !== 0) {
            _.each(data.items, function (i) { i._type = t; });
            items[t] = data.items;
          }
          done(items);
        }, this));
      }, this));
    },

    done: function (items) {

      // Render results.
      this._clear();
      this.resetHighlight();
      if (_.isEmpty(items)) {
        this.hideResults();
        return;
      } else if (!_.find(items, function (i) { return i.length !== 0; })) {
        this.hideResults();
        return;
      }

      // for channels, sort on whether the channel is open, otherwise
      // by dataset title.
      // Note: We can move this to the server by adding open datasets to the query
      // if it gets slow.
      if (items.channels) {
        items.channels.sort(_.bind(function(a, b) {
          var _a = -1, _b = -1;
          if (a.parent && a.parent.id)
            _a = this.datasetList.indexOf(Number(a.parent.id));
          if (b.parent && b.parent.id)
            _b = this.datasetList.indexOf(Number(b.parent.id));
          if (_a !== -1 && _b === -1)
            return 1;
          else if (_a === -1 && _b !== -1)
            return -1;
          else {
            if (a.humanName === b.humanName && a.parent && a.parent.title
                && b.parent && b.parent.title) {
              return a.parent.title < b.parent.title ? 1 : -1;
            } else
              return a.humanName < b.humanName ? 1 : -1;
            }
        }, this));
      }

      // Add to collection.
      _.each(this.options.types, _.bind(function (t) {
        if (items[t])
          _.each(items[t], _.bind(function (i) {
            this.collection.unshift(i);
          }, this));
      }, this));

      // Show results display.
      this.showResults();
    },

    // Clear the collection w/out re-rendering.
    _clear: function () {
      _.each(this.views, _.bind(function (v) {
        v.destroy();
        this.collection.remove(v.model);
      }, this));
    },

    defaults: function () {
      if (this.options.default) {

        var type = this.options.default.type;
        var query = this.options.default.query;
        rest.post('/api/' + type + '/list', {query: query},
            _.bind(function (err, data) {
          if (err) {
            return console.log(err);
          }
          var items = {};
          if (data[type].items.length !== 0) {
            _.each(data[type].items, function (i) { i._type = type; });
            items[type] = data[type].items;
          }
          this.done(items);
        }, this));
      }
    },

    choose: function (choice) {
      if (!this.options.choose) return;
      this.choiceContent.html(choice.$el.html());
      this.choiceWrap.show();
      this.hideResults();
      this.choice = choice;
      this.input.val('');
      if (this.options.onChoose) {
        this.options.onChoose();
      }
    },

    clearChoice: function (e) {
      this.choiceWrap.hide();
      this.choice = null;
      this.input.focus();
      if (this.options.onChoose)
        this.options.onChoose();
    },

    showResults: function () {
      this.results.show();
      if (this.collection.length > 0)
        this.input.parent().addClass('results');
    },

    hideResults: function () {
      if (!this.options.default) {
        this.results.hide();
        this.input.parent().removeClass('results');
      } else {
        if (!this.str) {
          
        }
      }
    },

    checkJustMe: function (e) {
      this.justme.attr('checked', true);
      this.allusers.attr('checked', false);
    },

    checkAllUsers: function (e) {
      this.justme.attr('checked', false);
      this.allusers.attr('checked', true);
    },

  });
});
