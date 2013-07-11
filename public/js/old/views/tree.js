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
      var start = Date.now();
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
      $('.dashboard-search', this.el).placeholder();
      // console.log('tree.dash.jade:', Date.now() - start);
      this._super('render');
      if (!this.firstRender && !opts.loading && !opts.empty)
        this.draw();
      // console.log('render:', Date.now() - start);
      return this;
    },

    draw: function () {
      var self = this;
      var data = JSON.parse(JSON.stringify(this.model.data));
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
          .bind('loaded.jstree', _.bind(self.updateCheckedChannels, self, true))
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
              var title = node.humanName || node.shortName;
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
              var id = metadata.channelName, attr = {};
              if (id) attr.id = id;
              attr.rel = children.length > 0 ? 'root' : '';
              _.extend(node, {
                data: { title: title },
                metadata: metadata,
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
        checkbox: { override_ui: true },
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
        dnd: {
          drop_check: function (data) {
            App.publish('DragStart-' + self.model.get('tabId'));
            data.r.data('dragover').call(data.r);
            return true;
          },
          drop_uncheck: function (data) {
            data.r.data('dragout').call(data.r);
            $(document).bind('mouseup', function (e) {
              App.publish('DragEnd-' + self.model.get('tabId'));
              $(document).unbind('mouseup', arguments.callee);
            });
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

    visibleTimeChanged: function (visibleTime) {
      // Hide all channels which do not have schema in the given time range,
      // and are not checked.
      var self = this;
      var start = Date.now();
      function handleNode(parent) {
        if (!parent) return;
        var nodes = $('ul > li', parent);
        var visibleNodeCount = 0;
        nodes.each(function (i) {
          var node = $(nodes.get(i));
          var channelName = node.attr('id');
          if (channelName == null) {
            // This is a parent node.
            var visibleChildCount = handleNode(node);
            visibleNodeCount += visibleChildCount;
            var newState = visibleChildCount ? null : 'hide';
            if (node[0].state != newState) {
              node[0].state = newState;
              if (newState === 'hide') node.hide(); else node.show();
            }
          } else {
            var channelInfo = self.model.findChannelInfo(channelName);
            var visible = channelInfo.valid.some(function(v) {
              return v.beg < visibleTime.end && v.end > visibleTime.beg;
            });
            var newState =
                visible ? null :
                node.hasClass('jstree-checked') ? 'gray' :
                'hide';
            if (newState !== 'hide')
              ++visibleNodeCount;
            if (node[0].state != newState) {
              node[0].state = newState;
              if (newState === 'hide') {
                node.hide();
              } else if (newState === 'gray') {
                node.show();
                $('a', node).css({ color: 'gray' });
              } else {
                node.show();
                $('a', node).css({ color: 'black' });
              }
            }
          }
        });
        return visibleNodeCount;
      };
      handleNode(self.treeHolder);
      // console.log('visibleTimeChanged took:', Date.now() - start);
    },

    updateCheckedChannels: function (ensureOpen) {
      // Update all check marks.
      var self = this;
      var start = Date.now();
      var channelsGraphed = {};
      App.publish('FetchGraphedChannels-' + self.model.get('tabId'), 
                  [ function(channels) {
        channels.forEach(function(chan) {
          channelsGraphed[chan.channelName] = true;
        });
      } ]);

      function handleNode(parent) {
        var nodes = $('ul > li', parent);
        var checkedNodeCount = 0, allNodeCount = 0;
        nodes.each(function (i) {
          var node = $(nodes.get(i));
          var channelName = node.attr('id');
          if (channelName == null) {
            // This is a parent node.
            var childCounts = handleNode(node);
            checkedNodeCount += childCounts.checked;
            allNodeCount += childCounts.all;
            if (childCounts.checked == 0) {
              if (!node.hasClass('jstree-unchecked'))
                node.removeClass('jstree-checked')
                    .removeClass('jstree-undetermined')
                    .addClass('jstree-unchecked');
            } else if (childCounts.checked == childCounts.all) {
              if (!node.hasClass('jstree-checked'))
                node.removeClass('jstree-unchecked')
                    .removeClass('jstree-undetermined')
                    .addClass('jstree-checked');
            } else {
              if (!node.hasClass('jstree-undetermined'))
                node.removeClass('jstree-checked')
                    .removeClass('jstree-unchecked')
                    .addClass('jstree-undetermined');
            }
            if (ensureOpen && childCounts.checked) {
              self.treeHolder.jstree('open_node', node, false, true);
            }
          } else {
            ++allNodeCount;
            if (channelsGraphed[channelName]) {
              if (node.hasClass('jstree-unchecked'))
                node.removeClass('jstree-unchecked').addClass('jstree-checked');
              ++checkedNodeCount;
            } else {
              if (node.hasClass('jstree-checked'))
                node.removeClass('jstree-checked').addClass('jstree-unchecked');
            }
          }
        });
        return { checked: checkedNodeCount, all: allNodeCount };
      };
      handleNode(self.treeHolder);
      self.resize();
      // console.log('updateCheckedChannels took:', Date.now() - start);
      self.visibleTimeChanged(self.model.tabModel.get('visibleTime'));
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
        });
      } else {
        var channel = _.clone(data.o.data());
        channel.yaxisNum = data.r.data('axis.n');
        App.publish('ChannelRequested-' + 
            self.model.get('tabId') + '-' + graphId, [channel]);
      }
      if (data.r.data('dragout'))
        data.r.data('dragout').call(data.r);
      App.publish('DragEnd-' + self.model.get('tabId'));
    },

    nodeDroppedExternalHandler: function (data) {
      if (!this.el.is(':visible')) return;
      var self = this;
      var channel;
      if (data.r.hasClass('axisTarget')) {
        var targetGraphId = data.r.data('id');
        if (!targetGraphId) return;
        var yaxisNum = data.r.data('axis.n');
        var sourceGraphId = data.o.parent().attr('data-graph-id');
        if (sourceGraphId) {
          var sourceGraphModel = _.find(self.model.tabModel.graphModels,
              function (g) { return g.id == sourceGraphId; });
          var channelIndex = Number(data.o.parent().attr('data-channel-index'));
          channel = sourceGraphModel.get('channels')[channelIndex];
          App.publish('ChannelDropped-' + targetGraphId);
          $('.label-closer', data.o.parent().parent().parent()).click();
          done();
        } else {
          var vehicleId = self.model.get('vehicleId');
          var channelName = data.o.parent().data('channel-name');
          $(data.o.get(0).nextElementSibling).show();
          App.publish('FetchChannelInfo-' + vehicleId,
              [channelName, function (chan) {
            channel = chan;
            channel.title = channel.humanName || channel.shortName;
            if (channel.units)
              channel.title += ' (' + channel.units + ')';
            done();
          }]);
        }
        function done() {
          channel.yaxisNum = yaxisNum;
          App.publish('ChannelRequested-' + 
              self.model.get('tabId') + '-' + targetGraphId, [channel]);
        }
      }
      App.publish('DragEnd-' + self.model.get('tabId'));
    },

    nodeDraggedExternalHandler: function (data, cb) {
      if (!this.el.is(':visible')) return;
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
      var placeholder = $(e.target).attr('data-placeholder');
      var txt = $(e.target).val().trim();
      if (txt == placeholder) txt = '';
      this.treeHolder.jstree('search', txt);
    },

  });
});
