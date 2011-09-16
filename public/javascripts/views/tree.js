/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashitem', 'libs/jstree/jquery.jstree'],
    function (DashItemView) {
  return DashItemView.extend({
    events: {
      'click .toggler': 'toggle',
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
      this.content.jstree({ 
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
              var title;
              if (!node.parent ||
                  node.parent.shortName.indexOf('/') !== -1)
                title = node.shortName;
              title = title || node.humanName || node.shortName;
              _.extend(node, {
                data: {
                  title: title,
                },
                attr: {
                  rel: (children.length > 0 ? 'root' : ''),
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
        themes: {
          theme: 'apple',
        },
        plugins: [ 'themes', 'json_data', 'ui', 'checkbox', 'types', 'search' ],
      }).bind('select_node.jstree',
          function (e, data) {
        console.log(e, data);
      }).bind('open_node.jstree close_node.jstree '+
          'create_node.jstree delete_node.jstree',
          function (e, data) {
        self.resize();
      });
      
      return this;
    },

  });
});


/*

[
  { 
    data: 'A node', 
    metadata: { id : 23 },
    children: [ 'Child 1', 'A Child 2' ]
  },
  {
    attr: { 'id' : 'li.node.id1' }, 
    data: { 
      title: 'Long format demo', 
      attr: { 'href' : '#' } 
    } 
  }
]

*/






