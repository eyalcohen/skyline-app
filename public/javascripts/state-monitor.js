/*!
 * Copyright 2011 Mission Motors
 */

define(function () {

  function StateMonitor() {
    this.state = {};
    this.isRestoring = false;
    App.subscribe('VehicleRequested', _.bind(this.addTab, this));
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
          [tab.i, tabId, tab.t, timeRange]);
      _.each(tab.g, function (channels, graphId) {
        App.publish('GraphRequested-' + tabId, [graphId]);
        _.each(channels, function (channel, channelName) {
          console.log(channel);
          App.publish('ChannelRequested-' + 
              tabId + '-' + graphId, [channel]);
        });
      });
    });
    this.isRestoring = false;
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
    this.addGraph(tabId, 'MASTER');
    App.subscribe('GraphRequested-' + tabId,
        _.bind(this.addGraph, this, tabId));
    App.subscribe('GraphUnrequested-' + tabId,
        _.bind(this.removeGraph, this, tabId));
    App.subscribe('VisibleTimeChange-' + tabId,
        _.bind(this.updateTimeRange, this, tabId));
    App.subscribe('ShowFolderItem-target-' + tabId,
        _.bind(this.updateVisibility, this, tabId, true));
    App.subscribe('HideFolderItem-target-' + tabId, 
        _.bind(this.updateVisibility, this, tabId, false));
    App.subscribe('VehicleUnrequested-' + tabId,
        _.bind(this.removeTab, this, tabId));
  }

  StateMonitor.prototype.removeTab = function (tabId) {
    App.unsubscribe('GraphRequested-' + tabId, this.addGraph);
    App.unsubscribe('GraphUnrequested-' + tabId, this.removeGraph);
    App.unsubscribe('VisibleTimeChange-' + tabId, this.updateTimeRange);
    App.unsubscribe('VehicleUnrequested-' + tabId, this.removeTab);
    delete this.state[tabId];
  }


  StateMonitor.prototype.addGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    this.state[tabId].g[graphId] = {};
    App.subscribe('ChannelRequested-' + handle,
        _.bind(this.addChannel, this, tabId, graphId));
    App.subscribe('ChannelUnrequested-' + handle,
        _.bind(this.removeChannel, this, tabId, graphId));
  }

  StateMonitor.prototype.removeGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    delete this.state[tabId].g[graphId];
    App.unsubscribe('ChannelRequested-' + handle, this.addChannel);
    App.unsubscribe('ChannelUnRequested-' + handle, this.removeChannel);
  }


  StateMonitor.prototype.addChannel = function (tabId, graphId, channel) {
    this.state[tabId].g[graphId][channel.channelName] = channel;
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
          if (_.isNumber(n)) o[k] = n;
          else if (v === 'true') o[k] = true;
          else if (v === 'false') o[k] = false;
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
