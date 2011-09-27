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
      $('.tree', this.content).bind('loaded.jstree', 
          function (e, data) {
        //
      }).jstree({
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
              metadata.title = title;
              var id = metadata.channelName, attr = {};
              if (id)
                attr.id = id; // title.replace(' ', '-').toLowerCase(),
              attr.rel = children.length > 0 ? 'root' : '';
              _.extend(node, {
                data: { title: title },
                metadata: metadata,
                attr: attr,
                children: children,
              });
            }
          },
        },
        core: { animation: 0 },
        ui: {
          select_multiple_modifier: 'alt',
          initially_select: [App.defaultChannel.channelName],
        },
        checkbox: { override_ui: true },
        types : {
          types : {
            root : {
              icon : { image : $.jstree._themes + '/apple/drive.png' },
            },
            default : {
              icon : { image : $.jstree._themes + '/apple/data.png' }
            }
          }
        },
        search: { case_insensitive: true, show_only_matches: true },
        themes: { theme: 'apple' },
        dnd : {
          drop_check: function (data) {
            data.r.data('dragover').call(data.r);
            return true;
          },
          drop_uncheck: function (data) {
            data.r.data('dragout').call(data.r);
            return true;
          },
          drop_finish : function (data) {
            var graphId = data.r.parent().parent().data('id');
            var channel = data.o.data();
            channel.yaxisNum = data.r.data('axis.n');
            if (data.o.hasClass('jstree-unchecked')) {
              data.o.removeClass('jstree-unchecked')
              data.o.addClass('jstree-checked');
            }
            App.publish('ChannelRequested-' +
                self.model.attributes.vehicleId + '-' +
                graphId, [channel]);
            if (data.r.data('dragout'))
              data.r.data('dragout').call(data.r);
          },
          drag_check : function (data) {
            return {
              after : false,
              before : false,
              inside : true,
            };
          },
          drag_finish : function (data) {},
        },
        plugins: ['themes', 'json_data', 'ui', 'checkbox',
            'types', 'search', /*'contextmenu',*/ 'dnd'],
      }).bind('open_node.jstree close_node.jstree '+
          'create_node.jstree delete_node.jstree',
          function (e, data) {
        self.resize();
      }).bind('search.jstree', function (e, data) {
        console.warn('Found ' + data.rslt.nodes.length +
            ' nodes matching "' + data.rslt.str + '".');
        self.resize();
      }).bind('click.jstree', function (e) {
        var target = $(e.target);
        var node = target.hasClass('jstree-checkbox') ?
            target.parent().parent() : target.parent();
        if (!node.attr('id')) {
          var children = $('li', node);
          if (node.hasClass('jstree-checked')) {
            children.each(function (i) {
              App.publish('ChannelRequested-' + self.model.get('vehicleId'), 
                  [$(children.get(i)).data()]);
            });
          } else if (node.hasClass('jstree-unchecked')) {
            children.each(function (i) {
              App.publish('ChannelUnrequested-' + self.model.get('vehicleId'), 
                  [$(children.get(i)).data()]);
            });
          }
        } else {
          if (node.hasClass('jstree-checked')) {
            App.publish('ChannelRequested-' + self.model.get('vehicleId'), 
                [node.data()]);
          } else if (node.hasClass('jstree-unchecked')) {
            App.publish('ChannelUnrequested-' + self.model.get('vehicleId'), 
                [node.data()]);
          }
        }
      });
      

      return this;
    },

    search: function (e) {
      var txt = $(e.target).val().trim();
      $('.tree', this.content).jstree('search', txt);
    },

  });
});

