/*!
 * Copyright 2011 Mission Motors
 */

define(function () {

  function StateMonitor() {
    this.state = {};
    this.subs = {};
    this.isRestoring = false;
    var proxy = _.bind(this.addTab, this);
    App.subscribe('VehicleRequested', proxy);
    App.subscribe('NotAuthenticated', _.bind(function () {
      App.unsubscribe('VehicleRequested', proxy);
      App.unsubscribe('NotAuthenticated', arguments.callee);
    }, this));
  }

  StateMonitor.prototype.getState = function () {
    return encode(this.state);
  }

  StateMonitor.prototype.setState = function (str) {
    this.isRestoring = true;
    var state = decode(str);
    _.each(state, function (tab, tabId) {
      var timeRange = { beg: tab.r.b, end: tab.r.e };
      App.publish('VehicleRequested',
          [tab.i, tabId, tab.t, timeRange, !tab.v ]);
      _.each(tab.g, function (channels, graphId) {
        App.publish('GraphRequested-' + tabId, [graphId]);
        _.each(channels, function (channel, channelName) {
          App.publish('ChannelRequested-' +
              tabId + '-' + graphId, [channel]);
        });
      });
    });
    this.isRestoring = false;
  }

  StateMonitor.prototype.resetState = function (str) {
    _.each(this.state, _.bind(function (tab, tabId) {
      this.removeTab(tabId);
    }, this));
    this.state = {};
  }

  StateMonitor.prototype.addTab =
      function (vehicleId, tabId, vehicleTitle, timeRange) {
    this.state[tabId] = {
      v: true,
      i: vehicleId,
      t: vehicleTitle,
      r: { b: timeRange.beg, e: timeRange.end },
      g: {},
    };
    this.addSub('GraphRequested-' + tabId, 
                _.bind(this.addGraph, this, tabId));
    this.addSub('GraphUnrequested-' + tabId, 
                _.bind(this.removeGraph, this, tabId));
    this.addSub('VisibleTimeChange-' + tabId, 
                _.bind(this.updateTimeRange, this, tabId));
    this.addSub('ShowFolderItem-target-' + tabId, 
                _.bind(this.updateVisibility, this, tabId, true));
    this.addSub('HideFolderItem-target-' + tabId, 
                _.bind(this.updateVisibility, this, tabId, false));
    this.addSub('VehicleUnrequested-' + tabId, 
                _.bind(this.removeTab, this, tabId));
    this.addGraph(tabId, 'MASTER');
  }

  StateMonitor.prototype.removeTab = function (tabId) {
    _.each(this.state[tabId].g, _.bind(function (graph, graphId) {
      this.removeGraph(tabId, graphId);
    }, this));
    this.removeSub('GraphRequested-' + tabId);
    this.removeSub('GraphUnrequested-' + tabId);
    this.removeSub('VisibleTimeChange-' + tabId);
    this.removeSub('ShowFolderItem-target-' + tabId);
    this.removeSub('HideFolderItem-target-' + tabId);
    this.removeSub('VehicleUnrequested-' + tabId);
    delete this.state[tabId];
  }

  StateMonitor.prototype.addGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    this.state[tabId].g[graphId] = {};
    this.addSub('ChannelRequested-' + handle,
                _.bind(this.addChannel, this, tabId, graphId));
    this.addSub('ChannelUnrequested-' + handle,
                _.bind(this.removeChannel, this, tabId, graphId));
  }

  StateMonitor.prototype.removeGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    this.removeSub('ChannelRequested-' + handle);
    this.removeSub('ChannelUnRequested-' + handle);
    delete this.state[tabId].g[graphId];
  }

  StateMonitor.prototype.addChannel = function (tabId, graphId, channel) {
    if (!_.isArray(channel)) channel = [channel];
    _.each(channel, _.bind(function (c) {
      this.state[tabId].g[graphId][c.channelName] = c;
    }, this));
  }

  StateMonitor.prototype.removeChannel = function (tabId, graphId, channel) {
    delete this.state[tabId].g[graphId][channel.channelName];
  }


  StateMonitor.prototype.updateTimeRange = function (tabId, beg, end) {
    this.state[tabId].r = { b: beg, e: end };
  }

  StateMonitor.prototype.updateVisibility = function (tabId, visible) {
    this.state[tabId].v = visible;
  }

  StateMonitor.prototype.addSub = function (topic, fn) {
    this.subs[topic] = fn;
    App.subscribe(topic, fn);
  }

  StateMonitor.prototype.removeSub = function (topic) {
    App.unsubscribe(topic, this.subs[topic]);
    delete this.subs[topic];
  }

  /*!
   * Converts an object into a url encoded string.
   * Input must not contain self-references.
   */
  function encode(obj) {
    var str = '';
    (function step(obj, key) {
      _.each(obj, function (v, k) {
        // Some channelNames have dots
        // which are not encodable.
        // Replace them with commas.
        var k = k.replace(/\./g, ',');
        if (_.isObject(v))
          step(v, key ? key + objectDelimiter + k : k);
        else
          str += encodeURIComponent(key + objectDelimiter + k) +
                  '=' + encodeURIComponent(v) + '&';
      });
    })(obj);
    return str.substr(0, str.length - 1);
  }

  /*!
   * Converts a url encoded string into an object.
   */
  function decode(str) {
    var frags = str.split('&'), obj = {};
    _.each(frags, function (f) {
      var parms = f.split('=');
      var keys = parms[0].split(objectDelimiter);
      var v = decodeURIComponent(parms[1]);
      var o = obj, len = keys.length;
      _.each(keys, function (k, i) {
        // Put dots back after decoding commas
        k = decodeURIComponent(k).replace(/,/g, '.');
        if (i === len - 1) {
          var n = Number(v);
          if (v === 'true') o[k] = true;
          else if (v === 'false') o[k] = false;
          else if (!isNaN(n)) o[k] = n;
          else o[k] = v;
        }
        else if (!o[k]) o[k] = {};
        o = o[k];
      });
    });
    return obj;
  }

  var objectDelimiter = '.';

  return StateMonitor;
});
