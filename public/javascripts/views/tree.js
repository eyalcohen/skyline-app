/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem',
    'libs/jstree/jquery.jstree'],
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
      'keyup .dashboard-search': 'search',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.right;
      this.el = App.engine('tree.dash.jade', opts).appendTo(parent);
      this._super('render');
      if (!this.firstRender && !opts.loading && !opts.empty) {
        this.draw();
      }
      return this;
    },

    draw: function () {
      var self = this, data = this.model.attributes.data;
      $('.tree', this.content).jstree({
        json_data: {
          data: function (n, cb) {
            fillInternal(data, true);
            cb(data);
            function fillInternal(node, top) {
              var children = top ? node : node.sub || [];
              _.each(children, function (child) {
                child.parent = top ? null : node;
                fillInternal(child);
              });
              if (top) return;
              var title = !node.parent ||
                  node.parent.shortName.indexOf('/') !== -1 ?
                node.shortName :
                node.humanName || node.shortName,
                  metadata = {};
              _.each(node, function (val, key) {
                if (_.isString(val)) {
                  metadata[key] = val;
                  delete node[key];
                }
              });
              _.extend(node, {
                data: { title: title },
                metadata: metadata,
                attr: {
                  rel: (children.length > 0 ? 'root' : ''),
                  id: title.replace(' ', '-').toLowerCase(),
                },
                children: children,
              });
            }
          },
        },
        core: {
          animation: 0,
        },
        ui: {
          select_multiple_modifier: 'alt',
          initially_select: ['gps-speed'],
        },
        checkbox: {
          override_ui: false,
        },
        types : {
          types : {
            root : {
              icon : { 
                image : $.jstree._themes + '/apple/drive.png',
              },
            },
            default : {
              icon : { 
                image : $.jstree._themes + '/apple/data.png',
              },
            }
          }
        },
        search: {
          case_insensitive: true,
          show_only_matches: true,
        },
        themes: {
          theme: 'apple',
        },
        dnd : {
          drop_finish : function (data) { 
            var channelName = data.o.data('channelName'),
                axis = $('.graph').data('plot').getAxes().xaxis,
                range = { beginTime: axis.min * 1000, endTime: axis.max * 1000 };
            App.publish('ChannelRequested-' +
                self.model.attributes.vehicleId, [channelName, range]);
          },
          drag_check : function (data) {
            if(data.r.attr("id") == "phtml_1") {
              return false;
            }
            return { 
              after : false, 
              before : false, 
              inside : true 
            };
          },
          drag_finish : function (data) { 
            console.log("DRAG OK"); 
          }
        },
        plugins: ['themes', 'json_data', 'ui', 'checkbox',
            'types', 'search', 'contextmenu', 'dnd'],
      }).bind('select_node.jstree',
          function (e, data) {
        console.log(e, data);
      }).bind('open_node.jstree close_node.jstree '+
          'create_node.jstree delete_node.jstree',
          function (e, data) {
        self.resize();
      }).bind('search.jstree', function (e, data) {
        console.warn('Found ' + data.rslt.nodes.length +
            ' nodes matching "' + data.rslt.str + '".');
        self.resize();
      }).bind('move_node.jstree', function (e, data) {
        //
      }).jstree('check_node', $('#gps-speed'));
      return this;
    },

    search: function (e) {
      var txt = $(e.target).val().trim();
      $('.tree', this.content).jstree('search', txt);
    },

  });
});

