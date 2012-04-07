/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem',
    'libs/jstree/jquery.jstree'],
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'keyup .dashboard-search': 'search',
      'mouseenter .sidebar li': 'enterRow',
      'mouseleave .sidebar li': 'leaveRow',
      'click .sidebar li': 'load',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        waiting: false,
        loading: false,
        empty: false,
        shrinkable: this.options.shrinkable,
      });
      if (this.el.length)
        this.remove();
      this.el = App.engine('finder.dash.jade', opts)
                   .appendTo(this.options.parent);
      this._super('render');
      this.renderTree(opts);
      return this;
    },

    renderTree: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        waiting: false,
        loading: false,
        empty: false,
      });
      var wrap = $('.tree-wrap', this.el).empty();
      if (opts.waiting || opts.loading || opts.empty) {
        var msg = $('<p>').addClass('dashboard-item-message')
                          .appendTo(wrap);
        if (opts.waiting) msg.text('Waiting...');
        if (opts.loading) msg.text('Loading...');
        if (opts.empty) msg.text('Nothing to see.');
      } else if (!this.firstRender) {
        $('<div>').addClass('tree').appendTo(wrap);
        this.draw();
      }
    },

    load: function (e, type) {
      var self = this;
      var li, type;
      if (type)
        li = $('li[data-type="' + type + '"]', self.el);
      else {
        li = $(e.target).closest('li');
        type = li.data('type');
      }
      self.select(type);
      self.model.fetch(type);
    },

    select: function (type) {
      $('.sidebar li', this.el).removeClass('row-selected');
      $('li[data-type="' + type + '"]', this.el).addClass('row-selected');
    },

    draw: function () {
      var self = this;
      if (!self.model.data) return;
      var data = JSON.parse(JSON.stringify(self.model.data));
      var initiallySelect = 'none';
      var numNodes = 0;
      (function cnt(node, top) {
        var children = top ? node : node.sub || [];
        _.each(children, function (child) {
          numNodes++;
          cnt(child);
        });
      })(data, true);
      self.treeHolder = $('.tree', this.content)
          .bind('loaded.jstree', function () {
            self.treeHolder.jstree('open_all');
          })
          .jstree({
        json_data: {
          data: function (n, cb) {
            var numDone = 0;
            (function fillInternal(node, top) {
              var children = top ? node : node.sub || [];
              _.each(children, function (child) {
                child.parent = top ? null : node;
                fillInternal(child);
              });
              if (top) return;
              var title;
              switch (node.type) {
                case 'vehicles' : title = node.doc ? node.doc.title : node.title; break;
                case 'fleets' : title = node.title; break;
                case 'users' : title = node.displayName; break;
                case 'teams' : title = node.title; break;
              }
              var attr = {};
              attr['data-type'] = node.type;
              attr.rel = children.length > 0 ? 'root' : '';
              _.extend(node, {
                data: { title: title },
                attr: attr,
                children: children,
              });
              numDone++;
              if (numNodes === numDone) {
                cb(data);
                self.ready = true;
              }
            })(data, true);
          },
        },
        core: { animation: 0 },
        ui: {
          select_multiple_modifier: 'alt',
          initially_select: [initiallySelect],
        },
        types: {
          types: {
            root: {
              icon: { image: $.jstree._themes + '/apple/drive.png' },
            },
            default: {
              icon: { image: $.jstree._themes + '/apple/data.png' },
            }
          }
        },
        search: { case_insensitive: true, show_only_matches: true },
        themes: { theme: 'apple' },
        plugins: ['themes', 'json_data', 'ui',
            'types', 'search' /*'contextmenu',*/],
      }).bind('open_node.jstree close_node.jstree '+
          'create_node.jstree delete_node.jstree',
          function (e, data) {
        self.resize();
      }).bind('search.jstree', function (e, data) {
        _.each(data.rslt.nodes, function (n) {
          var item = $($(n).parent());
          if (item.attr('rel') === 'root') {
            // show the children too
            var kids = $('ul > li', item);
            _.each(kids, function (k) {
              $(k).show();
            });
          }
        });
        self.resize();
      }).bind('click.jstree', _.bind(self.nodeClickHandler, self));
      return self;
    },

    nodeClickHandler: function (e) {
      var self = this;
      var target = $(e.target);
      // TODO: something...
    },

    search: function (e) {
      var placeholder = $(e.target).attr('data-placeholder');
      var txt = $(e.target).val().trim();
      if (txt == placeholder) txt = '';
      this.treeHolder.jstree('search', txt);
    },

    enterRow: function (e) {
      var li = $(e.target).closest('li');
      li.children().each(function () {
        var _this = $(this);
        if (!_this.hasClass('arrow'))
          _this.css({'text-decoration': 'underline'});
      });
      this.bounceArrow(li);
    },

    leaveRow: function (e) {
      var li = $(e.target).closest('li');
      li.children().each(function () {
        var _this = $(this);
        if (!_this.hasClass('arrow'))
          _this.css({'text-decoration': 'none'});
      });
    },

    bounceArrow: function (row) {
      var self = this;
      var arrow = $('.arrow', row);
      if (arrow.length === 0) return;
      (function () {
        arrow.animate({
          'padding-right': '10px',
          easing: 'easeOutExpo',
        }, 200, function moveLeft() {
          arrow.css({ 'padding-right': '20px' });
        });
      })();
    },

    resize: function (delta) {
      this._super('resize', delta);
      $('.sidebar', this.el).height(this.content.height());
      $('.tree-wrap', this.el).height(this.content.height());
      this.addScroll(true);
    },

    addScroll: function (go, cb) {
      if ('function' === typeof go) {
        cb = go;
        go = false;
      }
      if (!go) return;
      $('.tree', this.content).jScrollPane({
        verticalGutter: 2,
        horizontalGutter: 2,
      });
      if(cb) cb();
    },

  });
});
