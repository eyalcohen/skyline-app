/*!
 * Copyright 2011 Mission Motors
 */

define(function () {

  function StateMonitor() {
    this.state = {};
    this.subs = {};
    this.isRestoring = false;
    var localAddTab = _.bind(this.addTab, this);
    App.subscribe('VehicleRequested', localAddTab);
    App.subscribe('NotAuthenticated', _.bind(function () {
      App.unsubscribe('VehicleRequested', localAddTab);
      App.unsubscribe('NotAuthenticated', arguments.callee);
    }, this));
  }

  StateMonitor.prototype.getState = function () {
    return encode(this.state);
  }

  StateMonitor.prototype.setState = function (str) {
    this.isRestoring = true;
    if (!str) App.router.navigate('/');
    else {
      // TODO: Handle decoding errors somehow.
      var state = decode(str);
      _.each(state, function (tab, tabId) {
        var visibleTime = { beg: tab.r.b, end: tab.r.e };
        App.publish('VehicleRequested',
            [tab.i, tabId, tab.t, visibleTime, !tab.v, function () {
              _.each(tab.g, function (channels, graphId) {
                if (graphId !== 'MASTER')
                  App.publish('GraphRequested-' + tabId, [graphId]);
                if (channels)
                  _.each(channels, function (opts, channelName) {
                    App.publish('FetchChannelInfo-' + tab.i,
                        [channelName, function (channel) {
                      channel.title = channel.humanName || channel.shortName;
                      if (channel.units)
                        channel.title += ' (' + channel.units + ')';
                      _.extend(channel, parseChannelOptions(opts));
                      App.publish('ChannelRequested-' +
                          tabId + '-' + graphId, [channel]);
                    }]);
                  });
              });
            }]);
      });
    }
    this.isRestoring = false;
  }

  StateMonitor.prototype.resetState = function (str) {
    _.each(this.state, _.bind(function (tab, tabId) {
      this.removeTab(tabId);
    }, this));
    this.state = {};
  }

  StateMonitor.prototype.getVehicleTime = function (vehicleId) {
    var tab = _.find(this.state, function (v, k) {
      return v.i === vehicleId;
    });
    return { beg: tab.r.b, end: tab.r.e };
  }

  StateMonitor.prototype.addTab =
      function (vehicleId, tabId, vehicleTitle, visibleTime, hide) {
    this.state[tabId] = {
      v: !hide,
      i: vehicleId,
      t: vehicleTitle,
      r: { b: visibleTime.beg, e: visibleTime.end },
      g: {},
    };
    this.addSub('GraphRequested-' + tabId,
                _.bind(this.addGraph, this, tabId));
    this.addSub('GraphUnrequested-' + tabId,
                _.bind(this.removeGraph, this, tabId));
    this.addSub('VisibleTimeChange-' + tabId,
                _.bind(_.debounce(this.updateTimeRange, 500), this, tabId));
    this.addSub('ShowFolderItem-target-' + tabId,
                _.bind(this.updateVisibility, this, tabId, true));
    this.addSub('HideFolderItem-target-' + tabId,
                _.bind(this.updateVisibility, this, tabId, false));
    this.addSub('VehicleUnrequested-' + tabId,
                _.bind(this.removeTab, this, tabId));
    this.addGraph(tabId, 'MASTER');
    update(this.state);
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
    update(this.state);
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
    update(this.state);
  }

  StateMonitor.prototype.addChannel = function (tabId, graphId, channel) {
    if (!_.isArray(channel)) channel = [channel];
    _.each(channel, _.bind(function (c) {
      var opts = c.units;
      opts += '-' + (c.colorNum || 0);
      opts += '-' + (c.yaxisNum || 1);
      this.state[tabId].g[graphId][c.channelName] = opts;
    }, this));
    update(this.state);
  }

  StateMonitor.prototype.removeChannel = function (tabId, graphId, channel) {
    delete this.state[tabId].g[graphId][channel.channelName];
    update(this.state);
  }

  StateMonitor.prototype.updateTimeRange = function (tabId, beg, end) {
    this.state[tabId].r = { b: beg, e: end };
    update(this.state);
  }

  StateMonitor.prototype.updateVisibility = function (tabId, visible) {
    this.state[tabId].v = visible;
    update(this.state, true);
  }

  StateMonitor.prototype.updateOpts = function (tabId, graphId, channel) {
    var opts = '';
    if (channel.displayUnits)
      opts += channel.displayUnits;
    else opts += channel.units;
    opts += '-' + channel.colorNum;
    opts += '-' + channel.yaxisNum;
    this.state[tabId].g[graphId][channel.channelName] = opts;
    update(this.state);
  }

  StateMonitor.prototype.addSub = function (topic, fn) {
    this.subs[topic] = fn;
    App.subscribe(topic, fn);
  }

  StateMonitor.prototype.removeSub = function (topic) {
    // WHY do some topics not get deleted?
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
        var kk = key ? key + objectDelimiter + k : k;
        if (_.isObject(v))
          if (!_.isEmpty(v))
            step(v, kk);
          else
            str += encodeURIComponent(kk) + '=false&';
        else
          str += encodeURIComponent(kk) +
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
        // Put dots back after decoding commas.
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

  /*!
   * Changes the current URL to reflect the app state.
   */
  function update(state, save) {
    var frag = encode(state);
    frag = frag !== '' ? '/?' + frag : '/';
    App.router.navigate(frag, { replace: !save });
  }

  function parseChannelOptions(str) {
    var opts = str.split('-');
    return {
      units: opts[0],
      colorNum: Number(opts[1] || 0),
      yaxisNum: Number(opts[2] || 1),
    }
  }

  var objectDelimiter = '.';

  return StateMonitor;
});
