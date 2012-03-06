/*!
 * Copyright 2011 Mission Motors
 */

define(function (fn) {
  return Backbone.Model.extend({
    initialize: function (args) {
      if (!args) args = {};
      _.extend(args, { model: this });

      // Attributes of note to other models:
      //   visibleTime.beg, visibleTime.end: current visible time range, in us.
      //   navigableTime.beg, navigableTime.end: current navigator time range.
      //   highlightedChannel: name of channel to highlight
      this.set({ highlightedChannel: null });

      this.tabId = args.tabId;
      this.vehicleId = args.vehicleId;
      this.targetClass = args.targetClass;

      App.vehicleTabModels[this.tabId] = this;

      _.bindAll(this, 'destroy', 'addGraph', 'removeGraph', 'verticalResize');
      App.subscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.subscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      App.subscribe('VehicleUnrequested-' + this.tabId, this.destroy);

      // This is purely for the benefit of StateMonitor.
      this.bind('change:visibleTime', function(model, visibleTime) {
        App.publish('VisibleTimeChange-' + this.tabId,
                    [ visibleTime.beg, visibleTime.end ]);
      });

      this.view = new App.views.VehicleTabView(args);
      this.view.render(args, 'vehicle.jade');

      this.modelArgs = {
        tabModel: this,
        tabId: this.tabId,
        vehicleId: this.vehicleId,
        target: this.targetClass,
        bottomPad: 0,
        singleVehicle: true,
        events: [],
      };

      this.graphModels = [];

      this.treeModel = new App.models.TreeModel(_.extend({}, this.modelArgs, {
        title: 'Available Channels',
        type: 'tree',
        side: 'left',
        viewId: App.util.makeId(9),
        parent: '.' + this.targetClass + ' div .dashboard-left .top',
        height: '40%',
      }));
      this.treeModel.fetch(false, _.bind(function () {
        if (args.channelTreeLoaded)
          args.channelTreeLoaded();
      }, this));

      this.mapModel = new App.models.MapModel(_.extend({}, this.modelArgs, {
        title: 'Location',
        type: 'map',
        side: 'left',
        viewId: App.util.makeId(9),
        parent: '.' + this.targetClass + ' div .dashboard-left .bottom',
        height: '60%',
        shrinkable: true,
      })).bind('change:events', function () {});

      this.eventsModel = new App.models.EventsModel(_.extend({}, this.modelArgs, {
        title: 'Vehicle Events',
        type: 'events',
        side: 'right',
        viewId: App.util.makeId(9),
        parent: '.' + this.targetClass + ' div .dashboard-right .bottom',
        height: '30%',
        shrinkable: true,
      })).bind('change:events', function () {
        this.view.render();
      });

      this.timelineModel =
          new App.models.TimelineModel(_.extend({}, this.modelArgs, {
        title: 'Timeline',
        type: 'timeline',
        side: 'right',
        viewId: App.util.makeId(9),
        parent: '.' + this.targetClass + ' div .dashboard-right .middle',
        height: '59px',
      })).bind('change:events', function () {
        this.view.render();
      });

      var self = this;
      this.eventCollection = new App.collections.EventCollection(
          _.extend({}, this.modelArgs, {})).bind('reset', function () {
        var dependents = [self.graphModels, self.mapModel,
            self.eventsModel, self.timelineModel];
        _.each(_.flatten(dependents, true), _.bind(function (dep) {
          if (this.models.length === 0)
            dep.trigger('change:events');
          else
            dep.set({ events: this.models });
        }, this));
      });

      this.addGraph('MASTER', true);

      this.eventCollection.fetch();

      return this;
    },

    destroy: function () {
      App.unsubscribe('GraphRequested-' + this.tabId, this.addGraph);
      App.unsubscribe('GraphUnrequested-' + this.tabId, this.removeGraph);
      App.unsubscribe('VehicleUnrequested-' + this.tabId, this.destroy);
      delete App.vehicleTabModels[this.tabId];
    },

    addGraph: function (id, noreset) {
      var height = this.graphModels.length > 0 ?
                  this.graphModels[0].view.content.parent().parent().height() : 0;
      var isMaster = id === 'MASTER';
      var graphModel = new App.models.GraphModel(
            _.extend({}, this.modelArgs, {
        title: isMaster ? 'Graphs' : null,
        type: 'graph',
        side: 'right',
        viewId: App.util.makeId(9),
        parent: '.' + this.targetClass + ' div .dashboard-right .top',
        height: '70%',
        bottomPad: isMaster ? 62 : 0,
        id: id,
        headless: !isMaster,
      })).bind('change:events', function () {
        if (this.view.plot)
          this.view.setupIcons(id);
      });
      if (!noreset) this.resetEvents();
      this.graphModels.push(graphModel);
      var len = this.graphModels.length;
      _.each(this.graphModels, function (gm) {
        if (gm.view.options.weight !== undefined) {
          gm.view.options.weight = gm.view.options.full ?
                                  100 / len : 70 / len;
        }
      });
      this.view.arrangeGraphs(height, null, true);
    },

    removeGraph: function (id) {
      var height = this.graphModels[0].view.content.parent().parent().height();
      this.graphModels = _.reject(this.graphModels, function (g) {
        if (g.get('id') === id) {
          g.destroy();
          return true;
        } else return false;
      });
      var len = this.graphModels.length;
      _.each(this.graphModels, function (gm) {
        if (gm.view.options.weight !== undefined) {
          gm.view.options.weight = gm.view.options.full ?
                                  100 / len : 70 / len;
        }
      });
      this.view.arrangeGraphs(height, null, true);
    },

    resetEvents: function () {
      this.eventCollection.fetch();
    },

    verticalResize: function (mod, delta, opts) {
      var self = this;
      if (!opts) opts = {};
      var height = this.graphModels[0].view.content.parent().parent().height();
      var neighbors = _.filter(_.flatten([self.treeModel, self.mapModel,
                              self.graphModels, self.eventsModel], true),
                              function (m) {
        return m.attributes.side === mod.attributes.side
              && m.attributes.viewId !== mod.attributes.viewId;
      });
      mod.view.options.height += delta;
      if (opts.hide) {
        mod.view.options.oldWeight = mod.view.options.weight;
        mod.view.options.weight = 0;
      } else if (opts.show) {
        mod.view.options.weight = mod.view.options.oldWeight;
      }
      mod.view.resize();
      var nw = 100 / neighbors.length;
      var diff = Math.ceil(delta / neighbors.length);
      var rem = delta - (neighbors.length * diff);
      if (neighbors[0].view.options.weight !== undefined)
        neighbors[0].view.options.height -= rem;
      _.each(neighbors, function (n) {
        if (n.view.options.weight !== undefined) {
          n.view.options.height -= diff;
          if (opts.hide) {
            n.view.options.oldWeight = n.view.options.weight;
            n.view.options.full = true;
            n.view.options.weight = nw;
          } else if (opts.show) {
            n.view.options.weight = n.view.options.oldWeight;
            n.view.options.full = false;
          }
          n.view.resize();
        }
      });
    },

  });
});

