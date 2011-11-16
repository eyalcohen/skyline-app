/*!
 * Copyright 2011 Mission Motors
 */

define(['views/dashItem',
    'libs/jstree/jquery.jstree'],
    function (DashItemView) {
  return DashItemView.extend({
    initialize: function (args) {
      this._super('initialize', args);
      this.ready = false;
    },

    events: {
      'click .toggler': 'toggle',
      'keyup .dashboard-search': 'search',
    },

    render: function (opts) {
      opts = opts || {};
      _.defaults(opts, {
        title: this.options.title,
        loading: false,
        empty: false,
        shrinkable: false,
      });
      if (this.el.length) {
        this.remove();
      }
      var parent = this.options.parent || App.regions.left;
      this.el = App.engine('tree.dash.jade', opts).appendTo(parent);
      this._super('render');
      if (!this.firstRender && !opts.loading && !opts.empty) {
        this.draw();
      }
      return this;
    },

    draw: function () {
      var self = this;
      var data = JSON.parse(JSON.stringify(this.model.get('data')));
      var initiallySelect = 'none';
      var numNodes = 0;
      (function cnt(node, top) {
        var children = top ? node : node.sub || [];
        _.each(children, function (child) {
          numNodes++;
          cnt(child);
        });
      })(data, true);
      self.treeHolder = $('.tree', this.content).jstree({
        json_data: {
          data: function (n, cb) {            
            var numDone = 0;
            var defaultChannel;
            (function fillInternal(node, top) {
              var children = top ? node : node.sub || [];
              _.each(children, function (child) {
                child.parent = top ? null : node;
                fillInternal(child);
              });
              if (top) return;
              var title = node.channelName || node.shortName;
              if (node.units)
                title += ' (' + node.units + ')';
              var metadata = {};
              _.each(node, function (val, key) {
                if (_.isString(val)) {
                  metadata[key] = val;
                  delete node[key];
                }
              });
              metadata.title = title;
              // if (metadata.channelName === 'mc/motorSpeed'
              //     || metadata.channelName === 'mc.motorSpeed_RPM') {
              //   defaultChannel = _.clone(metadata);
              // }
              var id = metadata.channelName, attr = {};
              if (id) attr.id = id;
              attr.rel = children.length > 0 ? 'root' : '';
              _.extend(node, {
                data: { title: title },
                metadata: metadata,
                attr: attr,
                children: children,
              });
              if (!defaultChannel)
                defaultChannel = _.clone(metadata);
              numDone++;
              if (numNodes === numDone) {
                cb(data);
                self.ready = true;
                if (defaultChannel)
                  self.trigger('ready', defaultChannel);
              }
            })(data, true);
          },
        },
        core: { animation: 0 },
        ui: {
          select_multiple_modifier: 'alt',
          initially_select: [initiallySelect],
        },
        checkbox: { override_ui: true },
        types: {
          types: {
            root: {
              icon: { image: $.jstree._themes + '/apple/drive.png' },
            },
            default: {
              icon: { image: $.jstree._themes + '/apple/data.png' }
            }
          }
        },
        search: { case_insensitive: true, show_only_matches: true },
        themes: { theme: 'apple' },
        dnd: {
          drop_check: function (data) {
            App.publish('DragStart-' + self.model.get('tabId'));
            data.r.data('dragover').call(data.r);
            return true;
          },
          drop_uncheck: function (data) {
            data.r.data('dragout').call(data.r);
            return true;
          },
          drop_finish: _.bind(self.nodeDroppedHandler, self),
          drag_check: function (data) {
            return { after: false, before: false, inside: true };
          },
          drag_finish: function (data) {},
          ignore_multiple_selection: true,
          external_drop_only: true,
          from_external_drop_check: _.bind(self.nodeDroppedExternalHandler, self),
          from_external_drag_check: _.bind(self.nodeDraggedExternalHandler, self),
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
      }).bind('click.jstree', _.bind(self.nodeClickHandler, self));
      return self;
    },

    nodeClickHandler: function (e) {
      var self = this;
      var target = $(e.target);
      if (target.hasClass('jstree-icon')) return;
      var node = target.hasClass('jstree-checkbox') ?
          target.parent().parent() : target.parent();
      // Just use the first graph.
      var graphId = 'MASTER';
      if (!node.attr('id')) {
        var children = $('ul > li', node);
        var requestedChannels = [];
        if (node.hasClass('jstree-checked')) {
          children.each(function (i) {
            var channel = _.clone($(children.get(i)).data());
            requestedChannels.push(channel);
          });
          App.publish('ChannelRequested-' + 
              self.model.get('tabId') + '-' + graphId, [requestedChannels]);
        } else if (node.hasClass('jstree-unchecked')) {
          var graphs = $('.' + self.model.get('target') + ' .graph');
          children.each(function (i) {
            var channel = _.clone($(children.get(i)).data());
            graphs.each(function (i) {
              var gid = $(graphs.get(i)).data('id');
              App.publish('ChannelUnrequested-' +
                  self.model.get('tabId') + '-' + gid, [channel]);
            });
          });
        }
      } else {
        var channel = _.clone(node.data());
        if (node.hasClass('jstree-checked')) {
          App.publish('ChannelRequested-' + 
              self.model.get('tabId') + '-' + graphId, [channel]);
        } else if (node.hasClass('jstree-unchecked')) {
          var graphs = $('.' + self.model.get('target') + ' .graph');
          graphs.each(function (i) {
            var gid = $(graphs.get(i)).data('id');
            App.publish('ChannelUnrequested-' +
                self.model.get('tabId') + '-' + gid, [channel]);
          });
        }
      }
    },

    nodeDroppedHandler: function (data) {
      var self = this;
      var graphId = data.r.data('id');
      var yaxisNum = data.r.data('axis.n');
      if (!data.o.attr('id')) {
        var children = $('ul > li', data.o);
        children.each(function (i) {
          var child = $(children.get(i));
          var channel = _.clone(child.data());
          channel.yaxisNum = yaxisNum;
          App.publish('ChannelRequested-' + 
              self.model.get('tabId') + '-' + graphId, [channel]);
          if (child.hasClass('jstree-unchecked')) {
            child.removeClass('jstree-unchecked')
                .addClass('jstree-checked');
          }
        });
        if (data.o.hasClass('jstree-unchecked')) {
          data.o.removeClass('jstree-unchecked')
              .addClass('jstree-checked');
        } else if (data.o.hasClass('jstree-undetermined')) {
          data.o.removeClass('jstree-undetermined')
            .addClass('jstree-checked');
        }
      } else {
        var channel = _.clone(data.o.data());
        channel.yaxisNum = data.r.data('axis.n');
        App.publish('ChannelRequested-' + 
            self.model.get('tabId') + '-' + graphId, [channel]);
        if (data.o.hasClass('jstree-unchecked')) {
          data.o.removeClass('jstree-unchecked')
              .addClass('jstree-checked');
        }
        self.handleParentVisibility(data.o.parent().parent());
      }
      if (data.r.data('dragout'))
        data.r.data('dragout').call(data.r);
      App.publish('DragEnd-' + self.model.get('tabId'));
    },

    nodeDroppedExternalHandler: function (data) {
      if (data.r.hasClass('axisTarget')) {
        var graphId = data.r.data('id');
        if (!graphId) return;
        var yaxisNum = data.r.data('axis.n');
        var channel = JSON.parse(data.o.parent().attr('data-channel'));
        App.publish('ChannelDropped-' + graphId);
        $('.label-closer', data.o.parent().parent().parent()).click();
        channel.yaxisNum = yaxisNum;
        console.log('ChannelRequested-' + 
            this.model.get('tabId') + '-' + graphId);
        App.publish('ChannelRequested-' + 
            this.model.get('tabId') + '-' + graphId, [channel]);
      }
      App.publish('DragEnd-' + this.model.get('tabId'));
    },

    nodeDraggedExternalHandler: function (data, cb) {
      App.publish('DragStart-' + this.model.get('tabId'));
      if (data.r.hasClass('axisTarget')) {
        data.r.data('dragover').call(data.r);
        cb(true);
        data.r.bind('mouseleave', function (e) {
          cb(false);
          data.r.unbind('mouseleave');
          data.r.data('dragout').call(data.r);
        });
      }
    },

    search: function (e) {
      var txt = $(e.target).val().trim();
      this.treeHolder.jstree('search', txt);
    },

    showChannel: function (channelName, ensureOpen) {
      var self = this;
      if (!self.ready) {
        _.delay(_.bind(arguments.callee, self),
            200, channelName, ensureOpen);
        return;
      }
      var nodes = $('li', self.treeHolder);
      nodes.each(function (i) {
        var node = $(nodes.get(i));
        if (node.attr('id') === channelName
            && node.hasClass('jstree-unchecked')) {
          node.removeClass('jstree-unchecked')
              .addClass('jstree-checked');
          self.handleParentVisibility(node.parent().parent());
          if (ensureOpen)
            self.treeHolder.jstree('open_node', node.parent().parent(), false, true);
        }
      });
    },

    hideChannel: function (channelName) {
      var self = this;
      var nodes = $('li', this.treeHolder);
      nodes.each(function (i) {
        var node = $(nodes.get(i));
        if (node.attr('id') === channelName
            && node.hasClass('jstree-checked')) {
          node.removeClass('jstree-checked')
              .addClass('jstree-unchecked');
          self.handleParentVisibility(node.parent().parent());
        }
      });
    },

    handleParentVisibility: function (parentNode) {
      var children = $('ul > li', parentNode);
      var hasChecked = false, hasUnchecked = false;
      children.each(function (j) {
        var parentChild = $(children.get(j));
        if (parentChild.hasClass('jstree-checked'))
          hasChecked = true;
        else if (parentChild.hasClass('jstree-unchecked'))
          hasUnchecked = true;
      });
      var classToAddToParent = hasChecked && !hasUnchecked ?
          'jstree-checked' : (hasChecked && hasUnchecked ?
          'jstree-undetermined' : 'jstree-unchecked');
      parentNode.removeClass('jstree-checked')
          .removeClass('jstree-undetermined')
          .addClass(classToAddToParent);
    },

  });
});

