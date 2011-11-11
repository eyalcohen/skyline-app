/*!
 * Copyright 2011 Mission Motors
 */

define(function () {

  function StateMonitor() {
    this.tabs = {};
    App.subscribe('VehicleRequested', _.bind(this.addTab, this));
  }


  StateMonitor.prototype.addTab = 
      function (vehicleId, tabId, vehicleTitle, timeRange) {
    this.tabs[tabId] = {
      v: true,
      i: vehicleId,
      t: vehicleTitle,
      r: timeRange.beg + ',' + timeRange.end,
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
    delete this.tabs[tabId];
  }


  StateMonitor.prototype.addGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    this.tabs[tabId].g[graphId] = {};
    App.subscribe('ChannelRequested-' + handle,
        _.bind(this.addChannel, this, tabId, graphId));
    App.subscribe('ChannelUnrequested-' + handle,
        _.bind(this.removeChannel, this, tabId, graphId));
  }

  StateMonitor.prototype.removeGraph = function (tabId, graphId) {
    var handle = tabId + '-' + graphId;
    delete this.tabs[tabId].g[graphId];
    App.unsubscribe('ChannelRequested-' + handle, this.addChannel);
    App.unsubscribe('ChannelUnRequested-' + handle, this.removeChannel);
  }


  StateMonitor.prototype.addChannel = function (tabId, graphId, channel) {
    this.tabs[tabId].g[graphId][channel.channelName] = {
      // c: channel.color,
      // a: channel.axis,
    };
  }

  StateMonitor.prototype.removeChannel = function (tabId, graphId, channel) {
    delete this.tabs[tabId].g[graphId][channel.channelName];
  }


  StateMonitor.prototype.updateTimeRange = function (tabId, beg, end) {
    this.tabs[tabId].r = beg + ',' + end;
  }

  StateMonitor.prototype.updateVisibility = function (tabId, visible) {
    this.tabs[tabId].v = visible;
  }


  StateMonitor.prototype.encode = function () {
    var p, url, str = '';
    encode(this.tabs, true);
    str = str.substr(0, str.length - 1);
    var url = 'http://' + window.location.host + '/?';
    return url + encodeURI(str);
    function encode(obj, top) {
      _.each(obj, function (v, k) {
        if (top) p = k;
        if (_.isObject(v)) {
          if (!top) p += '.' + k;
          encode(v);
        } else {
          str += p + '.' + k + '=' + v + '&';
        }
      });
    }
  }

  StateMonitor.prototype.restore = function (str) {
    str = str.substr(str.indexOf('?') + 1);
    var frags = decodeURI(str).split('&'), tabs = {};
    _.each(frags, function (f) {
      var param = f.split('=');
      var keys = param[0].split('.');
      var v = param[1];

      //if (tabs[keys])
    });
    // return tabs;
  }

  return StateMonitor;
});
